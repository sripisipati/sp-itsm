import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { CabDecisionType, RoleName } from "../../generated/prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { PrismaService } from "../../database/prisma.service";
import { allocateNumber, recordHistory } from "./change.support";
import { ChangeWorkflowService } from "./change-workflow.service";

class CabMeetingDto {
  @IsString() @MinLength(3) title!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsArray() @IsUUID("4", { each: true }) memberIds?: string[];
  @IsOptional() @IsArray() @IsUUID("4", { each: true }) changeIds?: string[];
}

class CabDecisionDto {
  @IsUUID() changeId!: string;
  @IsEnum(CabDecisionType) decision!: CabDecisionType;
  @IsOptional() @IsString() comments?: string;
}

const cabReaders = [RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER, RoleName.CAB_MEMBER, RoleName.CHANGE_AUDITOR, RoleName.CHANGE_OWNER, RoleName.READ_ONLY] as const;

@ApiTags("cab")
@ApiBearerAuth()
@Controller("cab/meetings")
export class CabController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: ChangeWorkflowService,
  ) {}

  @Get()
  @Roles(...cabReaders)
  async list() {
    const rows = await this.prisma.cabMeeting.findMany({
      include: { members: true, agenda: { include: { change: { select: { id: true, number: true, shortDescription: true, riskLevel: true, state: true } } } } },
      orderBy: { startsAt: "desc" },
    });
    return { data: rows };
  }

  @Post()
  @Roles(RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER, RoleName.CAB_MEMBER)
  async create(@Body() dto: CabMeetingDto, @CurrentUser() user: AuthenticatedUser) {
    const meeting = await this.prisma.$transaction(async (tx) => {
      const number = await allocateNumber(tx, "CAB");
      return tx.cabMeeting.create({
        data: {
          number,
          title: dto.title,
          startsAt: new Date(dto.startsAt),
          endsAt: new Date(dto.endsAt),
          createdById: user.id,
          members: { create: (dto.memberIds ?? [user.id]).map((userId) => ({ userId })) },
          agenda: { create: (dto.changeIds ?? []).map((changeId) => ({ changeId })) },
        },
      });
    });
    return { data: meeting };
  }

  @Get(":id")
  @Roles(...cabReaders)
  async get(@Param("id", ParseUUIDPipe) id: string) {
    const meeting = await this.prisma.cabMeeting.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        agenda: { include: { change: true, decidedBy: { select: { id: true, firstName: true, lastName: true } } } },
        decisions: { include: { user: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
    return { data: meeting };
  }

  @Post(":id/decisions")
  @Roles(RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER, RoleName.CAB_MEMBER)
  async decide(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CabDecisionDto, @CurrentUser() user: AuthenticatedUser) {
    const decision = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cabDecision.create({
        data: { meetingId: id, changeId: dto.changeId, decision: dto.decision, comments: dto.comments, userId: user.id },
      });
      await tx.cabAgendaItem.updateMany({
        where: { meetingId: id, changeId: dto.changeId },
        data: { decision: dto.decision, comments: dto.comments, decidedById: user.id, decidedAt: new Date() },
      });
      await recordHistory(tx, { changeId: dto.changeId, userId: user.id, action: "CAB_DECISION", comment: `${dto.decision}: ${dto.comments ?? ""}` });
      return created;
    });
    if (dto.decision === CabDecisionType.APPROVE || dto.decision === CabDecisionType.REJECT) {
      const approval = await this.prisma.changeApproval.findFirst({
        where: { changeId: dto.changeId, approvalType: "CAB", status: { in: ["PENDING", "MORE_INFO"] } },
      });
      if (approval) {
        const change = await this.prisma.changeRequest.findUnique({ where: { id: dto.changeId } });
        if (change) {
          await this.workflow.decide(dto.changeId, approval.id, {
            decision: dto.decision === CabDecisionType.APPROVE ? "APPROVED" : "REJECTED",
            comments: dto.comments,
            version: change.version,
          }, user);
        }
      }
    }
    return { data: decision };
  }
}
