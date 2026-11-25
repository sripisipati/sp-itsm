import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  HistoryActionType,
  Impact,
  Incident,
  IncidentStatus,
  Prisma,
  Priority,
  Severity,
  Urgency,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { paginationMeta } from "../../common/pagination";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { AssignmentsService } from "../assignments/assignments.service";
import { AuditService } from "../audit/audit.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { NotesService } from "../notes/notes.service";
import { NotificationsService } from "../notifications/notifications.service";
import { canCreateIncident, canTransitionTo, canViewIncident, isRequesterOnly, permissionsFor } from "./domain/incident-access";
import { isTerminalStatus, isTransitionAllowed, OPEN_STATUSES } from "./domain/incident-rules";
import { buildIncidentOrder, buildIncidentWhere, IncidentListQuery } from "./domain/incident-query";
import { AssignIncidentDto, IncidentFieldsDto, UpdateIncidentDto, UpdateStatusDto } from "./dto/incident.dto";
import { detailInclude, listInclude, presentDetail, presentListItem } from "./incident.presenter";
import { TicketNumberService } from "./ticket-number.service";

const TRACKED = [
  "shortDescription",
  "description",
  "categoryId",
  "subcategoryId",
  "callerId",
  "contactInformation",
  "configurationItemId",
  "businessServiceId",
  "affectedLocation",
  "impact",
  "urgency",
  "severity",
  "priority",
  "impactedUsers",
  "assignmentGroupId",
  "assignedToId",
  "assignedOn",
  "status",
  "resolutionCode",
  "resolutionNotes",
  "resolvedById",
  "resolvedOn",
] as const;

type TrackedField = (typeof TRACKED)[number];

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tickets: TicketNumberService,
    private readonly configuration: ConfigurationService,
    private readonly assignments: AssignmentsService,
    private readonly audit: AuditService,
    private readonly notes: NotesService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: IncidentListQuery, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = buildIncidentWhere(query, user);
    const orderBy = buildIncidentOrder(query);
    const [totalRecords, rows] = await this.prisma.$transaction([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: listInclude,
      }),
    ]);
    return { data: rows.map(presentListItem), pagination: paginationMeta(page, pageSize, totalRecords) };
  }

  async summary(query: IncidentListQuery, user: AuthenticatedUser) {
    const where = buildIncidentWhere({ view: query.view }, user);
    const [total, open, inProgress, resolved] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.count({ where: { AND: [where, { status: { in: OPEN_STATUSES } }] } }),
      this.prisma.incident.count({ where: { AND: [where, { status: IncidentStatus.IN_PROGRESS }] } }),
      this.prisma.incident.count({ where: { AND: [where, { status: IncidentStatus.RESOLVED }] } }),
    ]);
    return { data: { total, open, inProgress, resolved } };
  }

  async exportCsv(query: IncidentListQuery, user: AuthenticatedUser): Promise<string> {
    const rows = await this.prisma.incident.findMany({
      where: buildIncidentWhere(query, user),
      orderBy: buildIncidentOrder(query),
      take: 5000,
      include: listInclude,
    });
    const header = ["Ticket Number", "Description", "Severity", "Priority", "Assigned To", "Assigned On", "Status", "Created By", "Created On", "Updated By", "Updated On"];
    const lines = rows.map((row) =>
      [
        row.ticketNumber,
        row.shortDescription,
        row.severity,
        row.priority,
        row.assignedTo ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}` : "",
        row.assignedOn?.toISOString() ?? "",
        row.status,
        row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}` : "",
        row.createdAt.toISOString(),
        row.updatedBy ? `${row.updatedBy.firstName} ${row.updatedBy.lastName}` : "",
        row.updatedAt.toISOString(),
      ].map(csvCell).join(","),
    );
    return [header.join(","), ...lines].join("\n");
  }

  async get(id: string, user: AuthenticatedUser) {
    return { data: await this.load(this.prisma, id, user) };
  }

  async history(id: string, user: AuthenticatedUser) {
    const detail = await this.load(this.prisma, id, user);
    return { data: detail.history };
  }

  async create(dto: IncidentFieldsDto, user: AuthenticatedUser) {
    if (!canCreateIncident(user)) {
      throw new ForbiddenException("You cannot create incidents.");
    }
    if (isRequesterOnly(user)) {
      dto.assignmentGroupId = null;
      dto.assignedToId = null;
      dto.resolutionCode = null;
      dto.resolutionNotes = null;
      if (dto.initialWorkNote) throw new ForbiddenException("You cannot add internal work notes.");
    }
    const createdId = await this.prisma.$transaction(async (tx) => {
      await this.configuration.assertReferences(tx, dto);
      await this.assignments.assertAssignment(tx, dto.assignmentGroupId ?? null, dto.assignedToId ?? null);
      const priority = await this.configuration.calculatePriority(tx, dto.impact, dto.urgency);
      const ticketNumber = await this.tickets.next(tx);
      const assigned = Boolean(dto.assignmentGroupId || dto.assignedToId);
      const status = assigned ? IncidentStatus.ASSIGNED : IncidentStatus.NEW;
      const now = new Date();
      const incident = await tx.incident.create({
        data: {
          ticketNumber,
          shortDescription: dto.shortDescription.trim(),
          description: dto.description.trim(),
          categoryId: dto.categoryId ?? null,
          subcategoryId: dto.subcategoryId ?? null,
          callerId: dto.callerId ?? user.id,
          contactInformation: dto.contactInformation ?? null,
          configurationItemId: dto.configurationItemId ?? null,
          businessServiceId: dto.businessServiceId ?? null,
          affectedLocation: dto.affectedLocation ?? null,
          impact: dto.impact,
          urgency: dto.urgency,
          severity: dto.severity,
          priority,
          impactedUsers: dto.impactedUsers ?? 1,
          assignmentGroupId: dto.assignmentGroupId ?? null,
          assignedToId: dto.assignedToId ?? null,
          assignedOn: assigned ? now : null,
          status,
          createdById: user.id,
          updatedById: user.id,
        },
      });
      await this.audit.record(tx, incident.id, user.id, [
        { fieldName: "status", oldValue: null, newValue: status, actionType: HistoryActionType.CREATED },
      ]);
      if (assigned) {
        await this.audit.record(tx, incident.id, user.id, [
          {
            fieldName: "assignedToId",
            oldValue: null,
            newValue: await this.label(tx, "assignedToId", dto.assignedToId ?? null),
            actionType: HistoryActionType.ASSIGNED,
          },
        ]);
      }
      if (dto.initialWorkNote?.trim()) {
        await this.notes.add(user, incident.id, { noteType: "WORK_NOTE", content: dto.initialWorkNote }, tx);
      }
      if (dto.initialComment?.trim()) {
        await this.notes.add(user, incident.id, { noteType: "ADDITIONAL_COMMENT", content: dto.initialComment }, tx);
      }
      if (dto.assignedToId && dto.assignedToId !== user.id) {
        await this.notifications.notify(tx, {
          userId: dto.assignedToId,
          title: `${ticketNumber} assigned to you`,
          body: dto.shortDescription,
          link: `/incidents/${incident.id}`,
        });
      }
      return incident.id;
    });
    return { data: await this.load(this.prisma, createdId, user) };
  }

  async update(id: string, dto: UpdateIncidentDto, user: AuthenticatedUser) {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.requireMutable(tx, id, user, dto.version);
      const next = await this.merge(tx, current, dto, user);
      await this.persist(tx, current, next, user, dto.version);
    });
    return { data: await this.load(this.prisma, id, user) };
  }

  async changeStatus(id: string, dto: UpdateStatusDto, user: AuthenticatedUser) {
    return this.update(id, {
      version: dto.version,
      status: dto.status,
      resolutionCode: dto.resolutionCode,
      resolutionNotes: dto.resolutionNotes,
    }, user);
  }

  async assign(id: string, dto: AssignIncidentDto, user: AuthenticatedUser) {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.requireMutable(tx, id, user, dto.version);
      if (!permissionsFor(user, current).canAssign) {
        throw new ForbiddenException("You cannot assign this incident.");
      }
      const nextStatus = current.status === IncidentStatus.NEW && (dto.assignmentGroupId || dto.assignedToId)
        ? IncidentStatus.ASSIGNED
        : current.status;
      await this.persist(tx, current, await this.merge(tx, current, {
        version: dto.version,
        assignmentGroupId: dto.assignmentGroupId ?? null,
        assignedToId: dto.assignedToId ?? null,
        status: nextStatus,
      }, user), user, dto.version);
    });
    return { data: await this.load(this.prisma, id, user) };
  }

  private async requireMutable(tx: Prisma.TransactionClient, id: string, user: AuthenticatedUser, version: number) {
    const current = await tx.incident.findFirst({ where: { id, archivedAt: null } });
    if (!current || !canViewIncident(user, current)) throw new NotFoundException("Incident not found.");
    if (current.version !== version) {
      throw new ConflictException("This incident was updated by someone else. Reload the record and try again.");
    }
    if (isTerminalStatus(current.status)) {
      throw new BadRequestException("Closed and cancelled incidents cannot be changed.");
    }
    return current;
  }

  private async merge(tx: Prisma.TransactionClient, current: Incident, dto: UpdateIncidentDto, user: AuthenticatedUser): Promise<Incident> {
    const next: Incident = { ...current };
    const assign = <K extends TrackedField>(field: K, value: Incident[K] | undefined) => {
      if (value !== undefined) next[field] = value as Incident[K];
    };
    assign("shortDescription", dto.shortDescription?.trim());
    assign("description", dto.description?.trim());
    assign("categoryId", dto.categoryId);
    assign("subcategoryId", dto.subcategoryId);
    assign("callerId", dto.callerId);
    assign("contactInformation", dto.contactInformation);
    assign("configurationItemId", dto.configurationItemId);
    assign("businessServiceId", dto.businessServiceId);
    assign("affectedLocation", dto.affectedLocation);
    assign("impact", dto.impact);
    assign("urgency", dto.urgency);
    assign("severity", dto.severity);
    assign("impactedUsers", dto.impactedUsers);
    assign("assignmentGroupId", dto.assignmentGroupId);
    assign("assignedToId", dto.assignedToId);
    assign("resolutionCode", dto.resolutionCode);
    assign("resolutionNotes", dto.resolutionNotes);
    if (dto.categoryId === null) next.subcategoryId = null;
    if (dto.impact || dto.urgency) {
      next.priority = await this.configuration.calculatePriority(tx, next.impact, next.urgency);
    }
    if (dto.status) next.status = dto.status;
    const assignmentChanged = next.assignmentGroupId !== current.assignmentGroupId || next.assignedToId !== current.assignedToId;
    if (assignmentChanged) next.assignedOn = next.assignmentGroupId || next.assignedToId ? new Date() : null;
    if (next.status !== current.status) {
      const rules = await tx.statusTransition.findMany({ where: { isActive: true } });
      if (!isTransitionAllowed(rules, current.status, next.status) || !canTransitionTo(user, current, next.status)) {
        throw new ForbiddenException(`Cannot change status from ${current.status} to ${next.status}.`);
      }
    } else if (!permissionsFor(user, current).canEdit) {
      throw new ForbiddenException("You cannot edit this incident.");
    }
    if (this.changedFields(current, next).some((field) => field !== "status") && !permissionsFor(user, current).canEdit) {
      throw new ForbiddenException("You cannot edit this incident.");
    }
    await this.configuration.assertReferences(tx, next);
    await this.assignments.assertAssignment(tx, next.assignmentGroupId, next.assignedToId);
    if (next.status === IncidentStatus.RESOLVED) {
      if (!next.resolutionCode || !next.resolutionNotes || next.resolutionNotes.trim().length < 5) {
        throw new BadRequestException("Resolution code and notes are required to resolve an incident.");
      }
      if (current.status !== IncidentStatus.RESOLVED) {
        next.resolvedById = user.id;
        next.resolvedOn = new Date();
      }
    }
    if (current.status === IncidentStatus.RESOLVED && next.status === IncidentStatus.IN_PROGRESS) {
      next.resolvedById = null;
      next.resolvedOn = null;
    }
    return next;
  }

  private async persist(tx: Prisma.TransactionClient, current: Incident, next: Incident, user: AuthenticatedUser, version: number) {
    const fields = this.changedFields(current, next);
    if (fields.length === 0) return;
    const entries = [];
    for (const field of fields) {
      entries.push({
        fieldName: field,
        oldValue: await this.label(tx, field, textValue(current[field])),
        newValue: await this.label(tx, field, textValue(next[field])),
        actionType: actionFor(field, current, next),
      });
    }
    const saved = await tx.incident.updateMany({
      where: { id: current.id, version },
      data: {
        shortDescription: next.shortDescription,
        description: next.description,
        categoryId: next.categoryId,
        subcategoryId: next.subcategoryId,
        callerId: next.callerId,
        contactInformation: next.contactInformation,
        configurationItemId: next.configurationItemId,
        businessServiceId: next.businessServiceId,
        affectedLocation: next.affectedLocation,
        impact: next.impact,
        urgency: next.urgency,
        severity: next.severity,
        priority: next.priority,
        impactedUsers: next.impactedUsers,
        assignmentGroupId: next.assignmentGroupId,
        assignedToId: next.assignedToId,
        assignedOn: next.assignedOn,
        status: next.status,
        resolutionCode: next.resolutionCode,
        resolutionNotes: next.resolutionNotes,
        resolvedById: next.resolvedById,
        resolvedOn: next.resolvedOn,
        updatedById: user.id,
        version: { increment: 1 },
      },
    });
    if (saved.count !== 1) {
      throw new ConflictException("This incident was updated by someone else. Reload the record and try again.");
    }
    await this.audit.record(tx, current.id, user.id, entries);
    if (next.assignedToId && next.assignedToId !== current.assignedToId && next.assignedToId !== user.id) {
      await this.notifications.notify(tx, {
        userId: next.assignedToId,
        title: `${current.ticketNumber} assigned to you`,
        body: next.shortDescription,
        link: `/incidents/${current.id}`,
      });
    }
    if (next.status === IncidentStatus.RESOLVED && current.status !== IncidentStatus.RESOLVED && next.callerId && next.callerId !== user.id) {
      await this.notifications.notify(tx, {
        userId: next.callerId,
        title: `${current.ticketNumber} was resolved`,
        body: next.shortDescription,
        link: `/incidents/${current.id}`,
      });
    }
  }

  private changedFields(current: Incident, next: Incident): TrackedField[] {
    return TRACKED.filter((field) => textValue(current[field]) !== textValue(next[field]));
  }

  private async label(tx: Prisma.TransactionClient, field: string, value: string | null): Promise<string | null> {
    if (!value) return null;
    if (field === "assignedToId" || field === "callerId" || field === "resolvedById") {
      const person = await tx.user.findUnique({ where: { id: value } });
      return person ? `${person.firstName} ${person.lastName}` : value;
    }
    if (field === "assignmentGroupId") {
      const group = await tx.assignmentGroup.findUnique({ where: { id: value } });
      return group?.name ?? value;
    }
    if (field === "categoryId" || field === "subcategoryId") {
      const category = await tx.incidentCategory.findUnique({ where: { id: value } });
      return category?.name ?? value;
    }
    if (field === "configurationItemId") {
      const item = await tx.configurationItem.findUnique({ where: { id: value } });
      return item?.name ?? value;
    }
    if (field === "businessServiceId") {
      const service = await tx.businessService.findUnique({ where: { id: value } });
      return service?.name ?? value;
    }
    return value;
  }

  private async load(db: PrismaService | Prisma.TransactionClient, id: string, user: AuthenticatedUser) {
    const incident = await db.incident.findFirst({ where: { id, archivedAt: null }, include: detailInclude });
    if (!incident || !canViewIncident(user, incident)) throw new NotFoundException("Incident not found.");
    const rules = await db.statusTransition.findMany({ where: { isActive: true } });
    return presentDetail(incident, user, rules);
  }
}

function textValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function actionFor(field: TrackedField, current: Incident, next: Incident): HistoryActionType {
  if (field === "status") {
    if (next.status === IncidentStatus.RESOLVED) return HistoryActionType.RESOLVED;
    if (next.status === IncidentStatus.CLOSED) return HistoryActionType.CLOSED;
    if (next.status === IncidentStatus.CANCELLED) return HistoryActionType.CANCELLED;
    if (current.status === IncidentStatus.RESOLVED && next.status === IncidentStatus.IN_PROGRESS) return HistoryActionType.REOPENED;
    return HistoryActionType.STATUS_CHANGED;
  }
  if (field === "assignedToId" || field === "assignmentGroupId" || field === "assignedOn") {
    return current.assignedToId ? HistoryActionType.REASSIGNED : HistoryActionType.ASSIGNED;
  }
  return HistoryActionType.UPDATED;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export type IncidentWrite = {
  impact: Impact;
  urgency: Urgency;
  severity: Severity;
  priority?: Priority;
};
