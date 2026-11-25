import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HistoryActionType, RoleName } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { userSelect } from "../users/user.presenter";
import { AuditService } from "../audit/audit.service";
import { IncidentGate } from "../incidents/incident-gate.service";
import { isPrivileged, permissionsFor } from "../incidents/domain/incident-access";
import { assertSafeUpload } from "./file-validation";
import { StorageService } from "./storage.service";

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gate: IncidentGate,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async list(user: AuthenticatedUser, incidentId: string) {
    await this.gate.require(incidentId, user);
    const rows = await this.prisma.incidentAttachment.findMany({
      where: { incidentId },
      include: { uploadedBy: { select: userSelect } },
      orderBy: { uploadedAt: "desc" },
    });
    return { data: rows.map(presentAttachment) };
  }

  async upload(user: AuthenticatedUser, incidentId: string, file: Express.Multer.File) {
    const incident = await this.gate.require(incidentId, user);
    if (!permissionsFor(user, incident).canUpload) {
      throw new ForbiddenException("You cannot upload attachments to this incident.");
    }
    const allowed = this.config.getOrThrow<string>("ATTACHMENT_ALLOWED_MIME").split(",").map((value) => value.trim());
    assertSafeUpload(file, this.config.getOrThrow<number>("ATTACHMENT_MAX_BYTES"), allowed);
    const stored = await this.storage.save(file.buffer, file.originalname);
    try {
      const attachment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.incidentAttachment.create({
          data: {
            incidentId,
            fileName: file.originalname.replace(/[\r\n"]/g, "_").slice(0, 180),
            storageKey: stored.storageKey,
            contentType: file.mimetype,
            fileSize: stored.size,
            uploadedById: user.id,
          },
          include: { uploadedBy: { select: userSelect } },
        });
        await this.audit.record(tx, incidentId, user.id, [
          {
            fieldName: "attachment",
            oldValue: null,
            newValue: created.fileName,
            actionType: HistoryActionType.ATTACHMENT_ADDED,
          },
        ]);
        return created;
      });
      return { data: presentAttachment(attachment) };
    } catch (error) {
      await this.storage.remove(stored.storageKey);
      throw error;
    }
  }

  async stream(user: AuthenticatedUser, incidentId: string, attachmentId: string) {
    await this.gate.require(incidentId, user);
    const attachment = await this.prisma.incidentAttachment.findFirst({ where: { id: attachmentId, incidentId } });
    if (!attachment) throw new NotFoundException("Attachment not found.");
    return { attachment, stream: this.storage.open(attachment.storageKey) };
  }

  async remove(user: AuthenticatedUser, incidentId: string, attachmentId: string) {
    const incident = await this.gate.require(incidentId, user);
    const attachment = await this.prisma.incidentAttachment.findFirst({ where: { id: attachmentId, incidentId } });
    if (!attachment) throw new NotFoundException("Attachment not found.");
    const canDelete =
      isPrivileged(user) ||
      (attachment.uploadedById === user.id && permissionsFor(user, incident).canUpload) ||
      (user.roles.includes(RoleName.SUPPORT_AGENT) && permissionsFor(user, incident).canEdit && attachment.uploadedById === user.id);
    if (!canDelete) throw new ForbiddenException("You cannot delete this attachment.");
    await this.prisma.$transaction(async (tx) => {
      await tx.incidentAttachment.delete({ where: { id: attachment.id } });
      await this.audit.record(tx, incidentId, user.id, [
        {
          fieldName: "attachment",
          oldValue: attachment.fileName,
          newValue: null,
          actionType: HistoryActionType.ATTACHMENT_REMOVED,
        },
      ]);
    });
    await this.storage.remove(attachment.storageKey);
    return { data: { deleted: true } };
  }
}

function presentAttachment(attachment: {
  id: string;
  incidentId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: Date;
  uploadedBy: { id: string; firstName: string; lastName: string };
}) {
  return {
    id: attachment.id,
    incidentId: attachment.incidentId,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    fileSize: attachment.fileSize,
    uploadedAt: attachment.uploadedAt,
    uploadedBy: { id: attachment.uploadedBy.id, name: `${attachment.uploadedBy.firstName} ${attachment.uploadedBy.lastName}` },
  };
}
