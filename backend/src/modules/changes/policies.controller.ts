import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ApprovalMode, ApprovalType, ChangeState, ChangeType, RoleName } from "../../generated/prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { PrismaService } from "../../database/prisma.service";

class PolicyDto {
  @IsString() name!: string;
  @IsEnum(ChangeType) changeType!: ChangeType;
  @IsEnum(ApprovalMode) mode!: ApprovalMode;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() allowSelfApproval?: boolean;
}

class PolicyStepDto {
  @IsInt() @Min(1) sequence!: number;
  @IsEnum(ApprovalType) approvalType!: ApprovalType;
  @IsEnum(RoleName) requiredRole!: RoleName;
  @IsOptional() @IsInt() deadlineHours?: number;
}

class RiskConfigDto {
  @IsNumber() impactWeight!: number;
  @IsNumber() probabilityWeight!: number;
  @IsNumber() downtimeWeight!: number;
  @IsNumber() userImpactWeight!: number;
  @IsNumber() veryHighMin!: number;
  @IsNumber() highMin!: number;
  @IsNumber() mediumMin!: number;
  @IsNumber() lowMin!: number;
}

class TransitionDto {
  @IsEnum(ChangeState) fromState!: ChangeState;
  @IsEnum(ChangeState) toState!: ChangeState;
  @IsString() guard!: string;
  @IsString() allowedRoles!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

const admins = [RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER] as const;

@ApiTags("change-policies")
@ApiBearerAuth()
@Controller()
export class ChangePoliciesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("change-categories")
  categories() {
    return this.prisma.changeCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }).then((data) => ({ data }));
  }

  @Get("approval-policies")
  @Roles(...admins, RoleName.CHANGE_AUDITOR)
  listPolicies() {
    return this.prisma.approvalPolicy.findMany({ include: { steps: { orderBy: { sequence: "asc" } } }, orderBy: { name: "asc" } }).then((data) => ({ data }));
  }

  @Post("approval-policies")
  @Roles(...admins)
  async createPolicy(@Body() dto: PolicyDto) {
    const data = await this.prisma.approvalPolicy.create({ data: { name: dto.name, changeType: dto.changeType, mode: dto.mode, isActive: dto.isActive ?? true, allowSelfApproval: dto.allowSelfApproval ?? false } });
    return { data };
  }

  @Post("approval-policies/:id/steps")
  @Roles(...admins)
  async addStep(@Param("id", ParseUUIDPipe) id: string, @Body() dto: PolicyStepDto) {
    const data = await this.prisma.approvalPolicyStep.create({ data: { policyId: id, sequence: dto.sequence, approvalType: dto.approvalType, requiredRole: dto.requiredRole, deadlineHours: dto.deadlineHours } });
    return { data };
  }

  @Get("risk-engine")
  @Roles(...admins, RoleName.CHANGE_AUDITOR, RoleName.CHANGE_OWNER)
  async risk() {
    const [config, factors, bands, ranks] = await Promise.all([
      this.prisma.riskEngineConfig.findUnique({ where: { id: "default" } }),
      this.prisma.riskFactorScore.findMany(),
      this.prisma.riskUserBand.findMany({ orderBy: { minUsers: "asc" } }),
      this.prisma.riskLevelRank.findMany(),
    ]);
    return { data: { config, factors, bands, ranks } };
  }

  @Patch("risk-engine")
  @Roles(RoleName.ITSM_ADMINISTRATOR)
  async updateRisk(@Body() dto: RiskConfigDto) {
    const data = await this.prisma.riskEngineConfig.update({ where: { id: "default" }, data: dto });
    return { data };
  }

  @Get("change-state-rules")
  @Roles(...admins, RoleName.CHANGE_AUDITOR)
  rules() {
    return this.prisma.changeStateRule.findMany({ orderBy: [{ fromState: "asc" }, { toState: "asc" }] }).then((data) => ({ data }));
  }

  @Post("change-state-rules")
  @Roles(RoleName.ITSM_ADMINISTRATOR)
  async addRule(@Body() dto: TransitionDto) {
    const data = await this.prisma.changeStateRule.create({ data: dto });
    return { data };
  }

  @Patch("change-state-rules/:id")
  @Roles(RoleName.ITSM_ADMINISTRATOR)
  async updateRule(@Param("id", ParseUUIDPipe) id: string, @Body() dto: TransitionDto) {
    const data = await this.prisma.changeStateRule.update({ where: { id }, data: dto });
    return { data };
  }
}
