import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { IsInt, Min } from "class-validator";
import { RoleName } from "../../generated/prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { ConfigService } from "@nestjs/config";
import { StorageService } from "../attachments/storage.service";
import { assertSafeUpload } from "../attachments/file-validation";
import { PrismaService } from "../../database/prisma.service";
import {
  AssessDto,
  AssignDto,
  CalendarQueryDto,
  ChangeQueryDto,
  ConflictQueryDto,
  CreateApprovalDto,
  CreateChangeDto,
  DecisionDto,
  NoteDto,
  PirDto,
  PreviewDto,
  StateDto,
  TaskDto,
  TestCaseDto,
  UpdateChangeDto,
} from "./change.dto";
import { ChangesService } from "./changes.service";
import { ChangeWorkflowService } from "./change-workflow.service";

class VersionDto {
  @IsInt() @Min(1) version!: number;
}

const readers = [
  RoleName.ITSM_ADMINISTRATOR,
  RoleName.CHANGE_MANAGER,
  RoleName.CHANGE_REQUESTER,
  RoleName.CHANGE_OWNER,
  RoleName.TECHNICAL_APPROVER,
  RoleName.BUSINESS_APPROVER,
  RoleName.CAB_MEMBER,
  RoleName.IMPLEMENTATION_LEAD,
  RoleName.CHANGE_AUDITOR,
  RoleName.READ_ONLY,
  RoleName.INCIDENT_MANAGER,
  RoleName.SUPPORT_AGENT,
  RoleName.REQUESTER,
] as const;

const editors = [RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER, RoleName.CHANGE_REQUESTER, RoleName.CHANGE_OWNER, RoleName.IMPLEMENTATION_LEAD] as const;

@ApiTags("changes")
@ApiBearerAuth()
@Controller("changes")
export class ChangesController {
  constructor(
    private readonly changes: ChangesService,
    private readonly workflow: ChangeWorkflowService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Roles(...readers)
  list(@Query() query: ChangeQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.changes.list(query, user);
  }

  @Get("summary")
  @Roles(...readers)
  summary() {
    return this.changes.summary();
  }

  @Get("calendar")
  @Roles(...readers)
  calendar(@Query() query: CalendarQueryDto) {
    return this.changes.calendar(query.from, query.to);
  }

  @Get("conflicts")
  @Roles(...readers)
  conflicts(@Query() query: ConflictQueryDto) {
    return this.changes.conflicts(query);
  }

  @Get("export")
  @Roles(...readers)
  @Header("Content-Type", "text/csv; charset=utf-8")
  async export(@Query() query: ChangeQueryDto, @CurrentUser() user: AuthenticatedUser, @Res({ passthrough: false }) response: Response) {
    const result = await this.changes.exportCsv(query, user);
    if (result.truncated) response.setHeader("x-export-truncated", "true");
    response.setHeader("Content-Disposition", "attachment; filename=\"changes.csv\"");
    response.send(result.csv);
  }

  @Post("preview-classification")
  @Roles(...editors)
  preview(@Body() dto: PreviewDto) {
    return this.changes.preview(dto);
  }

  @Post()
  @Roles(...editors)
  create(@Body() dto: CreateChangeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.changes.create(dto, user);
  }

  @Get(":id")
  @Roles(...readers)
  get(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.changes.get(id, user);
  }

  @Patch(":id")
  @Roles(...editors)
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateChangeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.changes.update(id, dto, user);
  }

  @Patch(":id/state")
  @Roles(RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER, RoleName.CHANGE_OWNER, RoleName.IMPLEMENTATION_LEAD, RoleName.CHANGE_REQUESTER)
  state(@Param("id", ParseUUIDPipe) id: string, @Body() dto: StateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.transition(id, dto, user);
  }

  @Post(":id/submit")
  @Roles(...editors)
  submit(@Param("id", ParseUUIDPipe) id: string, @Body() dto: VersionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.submit(id, dto.version, user);
  }

  @Post(":id/assess")
  @Roles(RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER, RoleName.CHANGE_OWNER)
  assess(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AssessDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.assess(id, dto, user);
  }

  @Post(":id/assign")
  @Roles(RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER, RoleName.CHANGE_OWNER)
  assign(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AssignDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.assign(id, dto, user);
  }

  @Get(":id/approvals")
  @Roles(...readers)
  approvals(@Param("id", ParseUUIDPipe) id: string) {
    return this.workflow.listApprovals(id);
  }

  @Post(":id/approvals")
  @Roles(RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER)
  addApproval(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateApprovalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.addApproval(id, dto, user);
  }

  @Post(":id/approvals/:approvalId/decision")
  @Roles(RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER, RoleName.TECHNICAL_APPROVER, RoleName.BUSINESS_APPROVER, RoleName.CAB_MEMBER, RoleName.CHANGE_OWNER)
  decision(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("approvalId", ParseUUIDPipe) approvalId: string,
    @Body() dto: DecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.decide(id, approvalId, dto, user);
  }

  @Get(":id/history")
  @Roles(...readers)
  history(@Param("id", ParseUUIDPipe) id: string) {
    return this.workflow.history(id);
  }

  @Get(":id/tasks")
  @Roles(...readers)
  tasks(@Param("id", ParseUUIDPipe) id: string) {
    return this.workflow.listTasks(id);
  }

  @Post(":id/tasks")
  @Roles(...editors)
  addTask(@Param("id", ParseUUIDPipe) id: string, @Body() dto: TaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.addTask(id, dto, user);
  }

  @Patch(":id/tasks/:taskId")
  @Roles(...editors)
  updateTask(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() dto: TaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.updateTask(id, taskId, dto, user);
  }

  @Get(":id/test-cases")
  @Roles(...readers)
  tests(@Param("id", ParseUUIDPipe) id: string) {
    return this.workflow.listTests(id);
  }

  @Post(":id/test-cases")
  @Roles(...editors)
  addTest(@Param("id", ParseUUIDPipe) id: string, @Body() dto: TestCaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.addTest(id, dto, user);
  }

  @Get(":id/notes")
  @Roles(...readers)
  notes(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.listNotes(id, user);
  }

  @Post(":id/notes")
  @Roles(...readers)
  addNote(@Param("id", ParseUUIDPipe) id: string, @Body() dto: NoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.addNote(id, dto, user);
  }

  @Post(":id/pir")
  @Roles(RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER, RoleName.CHANGE_OWNER, RoleName.IMPLEMENTATION_LEAD)
  pir(@Param("id", ParseUUIDPipe) id: string, @Body() dto: PirDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workflow.savePir(id, dto, user);
  }

  @Get(":id/attachments")
  @Roles(...readers)
  async attachments(@Param("id", ParseUUIDPipe) id: string) {
    const rows = await this.prisma.changeAttachment.findMany({ where: { changeId: id }, orderBy: { uploadedAt: "desc" } });
    return { data: rows };
  }

  @Post(":id/attachments")
  @Roles(...editors)
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { taskId?: string; testCaseId?: string; approvalId?: string; pirId?: string },
  ) {
    if (!file) throw new BadRequestException("A file is required.");
    const change = await this.prisma.changeRequest.findUnique({ where: { id } });
    if (!change) throw new BadRequestException("Change not found");
    const maxBytes = Number(this.config.get("ATTACHMENT_MAX_BYTES") ?? 5_000_000);
    const allowed = String(this.config.get("ATTACHMENT_ALLOWED_MIME") ?? "application/pdf,image/png,image/jpeg,text/plain,text/csv")
      .split(",")
      .map((item) => item.trim());
    assertSafeUpload(file, maxBytes, allowed);
    const stored = await this.storage.save(file.buffer, file.originalname);
    const row = await this.prisma.changeAttachment.create({
      data: {
        changeId: id,
        taskId: body.taskId,
        testCaseId: body.testCaseId,
        approvalId: body.approvalId,
        pirId: body.pirId,
        fileName: file.originalname,
        storageKey: stored.storageKey,
        contentType: file.mimetype,
        fileSize: stored.size,
        uploadedById: user.id,
      },
    });
    return { data: row };
  }
}

@ApiTags("approvals")
@ApiBearerAuth()
@Controller("approvals")
export class ApprovalsController {
  constructor(private readonly workflow: ChangeWorkflowService) {}

  @Post("escalate")
  @Roles(RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER)
  escalate() {
    return this.workflow.escalate();
  }
}
