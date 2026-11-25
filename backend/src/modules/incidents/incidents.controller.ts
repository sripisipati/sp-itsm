import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
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
import { RoleName } from "../../generated/prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { AttachmentsService } from "../attachments/attachments.service";
import { NotesService } from "../notes/notes.service";
import { AssignIncidentDto, CreateNoteDto, IncidentFieldsDto, IncidentQueryDto, UpdateIncidentDto, UpdateStatusDto } from "./dto/incident.dto";
import { IncidentsService } from "./incidents.service";

const editors = [RoleName.ITSM_ADMINISTRATOR, RoleName.INCIDENT_MANAGER, RoleName.SUPPORT_AGENT] as const;
const writers = [...editors, RoleName.REQUESTER] as const;

@ApiTags("incidents")
@ApiBearerAuth()
@Controller("incidents")
export class IncidentsController {
  constructor(
    private readonly incidents: IncidentsService,
    private readonly notes: NotesService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get()
  list(@Query() query: IncidentQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.incidents.list(query, user);
  }

  @Get("summary")
  summary(@Query() query: IncidentQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.incidents.summary(query, user);
  }

  @Get("export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async export(@Query() query: IncidentQueryDto, @CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    const csv = await this.incidents.exportCsv(query, user);
    response.setHeader("Content-Disposition", "attachment; filename=\"incidents.csv\"");
    response.send(csv);
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.incidents.get(id, user);
  }

  @Get(":id/history")
  history(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.incidents.history(id, user);
  }

  @Get(":id/notes")
  listNotes(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notes.list(user, id);
  }

  @Get(":id/attachments")
  listAttachments(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.attachments.list(user, id);
  }

  @Get(":id/attachments/:attachmentId/download")
  async download(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const { attachment, stream } = await this.attachments.stream(user, id, attachmentId);
    response.setHeader("Content-Type", attachment.contentType);
    const disposition = attachment.contentType.startsWith("image/") || attachment.contentType === "application/pdf" ? "inline" : "attachment";
    response.setHeader("Content-Disposition", `${disposition}; filename="${attachment.fileName.replace(/"/g, "")}"`);
    stream.pipe(response);
  }

  @Roles(...writers)
  @Post()
  @HttpCode(201)
  create(@Body() dto: IncidentFieldsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.incidents.create(dto, user);
  }

  @Roles(...editors)
  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateIncidentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.incidents.update(id, dto, user);
  }

  @Roles(...writers)
  @Patch(":id/status")
  status(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.incidents.changeStatus(id, dto, user);
  }

  @Roles(...editors)
  @Post(":id/assign")
  assign(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AssignIncidentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.incidents.assign(id, dto, user);
  }

  @Roles(...writers)
  @Post(":id/notes")
  @HttpCode(201)
  addNote(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notes.add(user, id, dto);
  }

  @Roles(...writers)
  @Post(":id/attachments")
  @HttpCode(201)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10_485_760 } }))
  upload(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException("Choose a file to upload.");
    return this.attachments.upload(user, id, file);
  }
}
