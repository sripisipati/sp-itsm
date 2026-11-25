import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { HistoryActionType, NoteType, Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { userSelect } from "../users/user.presenter";
import { AuditService } from "../audit/audit.service";
import { IncidentGate } from "../incidents/incident-gate.service";
import { canSeeWorkNotes, permissionsFor } from "../incidents/domain/incident-access";
import { isTerminalStatus } from "../incidents/domain/incident-rules";

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gate: IncidentGate,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, incidentId: string) {
    await this.gate.require(incidentId, user);
    const notes = await this.prisma.incidentNote.findMany({
      where: {
        incidentId,
        ...(canSeeWorkNotes(user) ? {} : { noteType: NoteType.ADDITIONAL_COMMENT }),
      },
      include: { createdBy: { select: userSelect } },
      orderBy: { createdAt: "desc" },
    });
    return { data: notes.map(presentNote) };
  }

  async add(
    user: AuthenticatedUser,
    incidentId: string,
    input: { noteType: NoteType; content: string },
    db?: Prisma.TransactionClient,
  ) {
    const incident = db
      ? await db.incident.findFirst({ where: { id: incidentId, archivedAt: null } })
      : await this.gate.require(incidentId, user);
    if (!incident) throw new BadRequestException("Incident not found.");
    if (isTerminalStatus(incident.status)) {
      throw new BadRequestException("Notes cannot be added to a closed or cancelled incident.");
    }
    const permissions = permissionsFor(user, incident);
    if (input.noteType === NoteType.WORK_NOTE && !permissions.canAddWorkNote) {
      throw new ForbiddenException("You cannot add internal work notes.");
    }
    if (input.noteType === NoteType.ADDITIONAL_COMMENT && !permissions.canAddComment) {
      throw new ForbiddenException("You cannot add comments on this incident.");
    }
    const write = async (tx: Prisma.TransactionClient) => {
      const note = await tx.incidentNote.create({
        data: {
          incidentId,
          noteType: input.noteType,
          content: input.content.trim(),
          createdById: user.id,
        },
        include: { createdBy: { select: userSelect } },
      });
      await this.audit.record(tx, incidentId, user.id, [
        {
          fieldName: "noteType",
          oldValue: null,
          newValue: input.noteType,
          actionType: HistoryActionType.NOTE_ADDED,
        },
      ]);
      return note;
    };
    const note = db ? await write(db) : await this.prisma.$transaction(write);
    return { data: presentNote(note) };
  }
}

export function presentNote(note: {
  id: string;
  incidentId: string;
  noteType: NoteType;
  content: string;
  createdAt: Date;
  createdBy: { id: string; firstName: string; lastName: string; email: string };
}) {
  return {
    id: note.id,
    incidentId: note.incidentId,
    noteType: note.noteType,
    content: note.content,
    createdAt: note.createdAt,
    createdBy: {
      id: note.createdBy.id,
      name: `${note.createdBy.firstName} ${note.createdBy.lastName}`,
      email: note.createdBy.email,
    },
  };
}

export type NoteDb = Db;
