import { HistoryActionType, IncidentStatus, NoteType } from "../../generated/prisma/client";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { userSelect } from "../users/user.presenter";
import { canSeeWorkNotes, canTransitionTo, permissionsFor } from "./domain/incident-access";
import { allowedTargets, TransitionRule } from "./domain/incident-rules";

type Person = { id: string; firstName: string; lastName: string; email?: string } | null;

export function person(user: Person) {
  if (!user) return null;
  return { id: user.id, name: `${user.firstName} ${user.lastName}`, ...(user.email ? { email: user.email } : {}) };
}

const listInclude = {
  assignedTo: { select: userSelect },
  createdBy: { select: userSelect },
  updatedBy: { select: userSelect },
} as const;

const detailInclude = {
  ...listInclude,
  caller: { select: userSelect },
  resolvedBy: { select: userSelect },
  category: true,
  subcategory: true,
  configurationItem: true,
  businessService: true,
  assignmentGroup: true,
  notes: { include: { createdBy: { select: userSelect } }, orderBy: { createdAt: "asc" as const } },
  attachments: { include: { uploadedBy: { select: userSelect } }, orderBy: { uploadedAt: "desc" as const } },
  history: { include: { changedBy: { select: userSelect } }, orderBy: { changedAt: "asc" as const } },
  changes: { select: { id: true, number: true, shortDescription: true, state: true, type: true }, orderBy: { createdAt: "desc" as const } },
} as const;

export { detailInclude, listInclude };

type ListIncident = {
  id: string;
  ticketNumber: string;
  shortDescription: string;
  severity: string;
  priority: string;
  assignedOn: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  assignedTo: Person;
  createdBy: Person;
  updatedBy: Person;
};

export function presentListItem(incident: ListIncident) {
  return {
    id: incident.id,
    ticketNumber: incident.ticketNumber,
    shortDescription: incident.shortDescription,
    severity: incident.severity,
    priority: incident.priority,
    assignedTo: person(incident.assignedTo),
    assignedOn: incident.assignedOn,
    status: incident.status,
    createdBy: person(incident.createdBy),
    createdAt: incident.createdAt,
    updatedBy: person(incident.updatedBy),
    updatedAt: incident.updatedAt,
    version: incident.version,
  };
}

export function presentDetail(
  incident: ListIncident & {
    description: string;
    contactInformation: string | null;
    affectedLocation: string | null;
    impact: string;
    urgency: string;
    impactedUsers: number;
    resolutionCode: string | null;
    resolutionNotes: string | null;
    resolvedOn: Date | null;
    caller: Person;
    resolvedBy: Person;
    category: { id: string; name: string } | null;
    subcategory: { id: string; name: string } | null;
    configurationItem: { id: string; name: string } | null;
    businessService: { id: string; name: string } | null;
    assignmentGroup: { id: string; name: string } | null;
    categoryId: string | null;
    subcategoryId: string | null;
    callerId: string | null;
    configurationItemId: string | null;
    businessServiceId: string | null;
    assignmentGroupId: string | null;
    assignedToId: string | null;
    createdById: string;
    status: IncidentStatus;
    notes: Array<{
      id: string;
      noteType: NoteType;
      content: string;
      createdAt: Date;
      createdBy: { id: string; firstName: string; lastName: string; email: string };
    }>;
    attachments: Array<{
      id: string;
      fileName: string;
      contentType: string;
      fileSize: number;
      uploadedAt: Date;
      uploadedBy: { id: string; firstName: string; lastName: string };
    }>;
    history: Array<{
      id: string;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      actionType: HistoryActionType;
      changedAt: Date;
      changedBy: { id: string; firstName: string; lastName: string };
    }>;
    changes?: Array<{ id: string; number: string; shortDescription: string; state: string; type: string }>;
  },
  user: AuthenticatedUser,
  rules: TransitionRule[],
) {
  const seeWorkNotes = canSeeWorkNotes(user);
  const notes = incident.notes
    .filter((note) => seeWorkNotes || note.noteType !== NoteType.WORK_NOTE)
    .map((note) => ({
      id: note.id,
      incidentId: incident.id,
      noteType: note.noteType,
      content: note.content,
      createdAt: note.createdAt,
      createdBy: person(note.createdBy),
    }));
  const history = incident.history.filter((entry) => seeWorkNotes || !(entry.actionType === HistoryActionType.NOTE_ADDED && entry.newValue === NoteType.WORK_NOTE));
  const permissions = permissionsFor(user, incident);
  const transitions = allowedTargets(rules, incident.status).filter((status) => canTransitionTo(user, incident, status));
  const activity = [
    ...history.map((entry) => ({
      id: entry.id,
      type: entry.actionType,
      fieldName: entry.fieldName,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      summary: historySummary(entry.actionType, entry.fieldName, entry.oldValue, entry.newValue),
      occurredAt: entry.changedAt,
      actor: person(entry.changedBy),
    })),
    ...notes.map((note) => ({
      id: note.id,
      type: "NOTE" as const,
      fieldName: "note",
      oldValue: null,
      newValue: note.noteType,
      summary: note.noteType === NoteType.WORK_NOTE ? "Work note added" : "Additional comment added",
      detail: note.content,
      occurredAt: note.createdAt,
      actor: note.createdBy,
    })),
  ].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  return {
    ...presentListItem(incident),
    description: incident.description,
    contactInformation: incident.contactInformation,
    affectedLocation: incident.affectedLocation,
    impact: incident.impact,
    urgency: incident.urgency,
    impactedUsers: incident.impactedUsers,
    resolutionCode: incident.resolutionCode,
    resolutionNotes: incident.resolutionNotes,
    resolvedOn: incident.resolvedOn,
    caller: person(incident.caller),
    resolvedBy: person(incident.resolvedBy),
    category: incident.category,
    subcategory: incident.subcategory,
    configurationItem: incident.configurationItem,
    businessService: incident.businessService,
    assignmentGroup: incident.assignmentGroup,
    categoryId: incident.categoryId,
    subcategoryId: incident.subcategoryId,
    callerId: incident.callerId,
    configurationItemId: incident.configurationItemId,
    businessServiceId: incident.businessServiceId,
    assignmentGroupId: incident.assignmentGroupId,
    assignedToId: incident.assignedToId,
    notes,
    attachments: incident.attachments.map((attachment) => ({
      id: attachment.id,
      incidentId: incident.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      fileSize: attachment.fileSize,
      uploadedAt: attachment.uploadedAt,
      uploadedBy: person(attachment.uploadedBy),
    })),
    history: history.map((entry) => ({
      id: entry.id,
      fieldName: entry.fieldName,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      actionType: entry.actionType,
      changedAt: entry.changedAt,
      changedBy: person(entry.changedBy),
    })),
    activity,
    allowedTransitions: transitions,
    permissions,
    relatedChanges: incident.changes ?? [],
  };
}

function historySummary(action: HistoryActionType, fieldName: string, oldValue: string | null, newValue: string | null): string {
  if (action === HistoryActionType.CREATED) return "Incident created";
  if (action === HistoryActionType.STATUS_CHANGED) return `Status changed from ${oldValue ?? "empty"} to ${newValue ?? "empty"}`;
  if (action === HistoryActionType.RESOLVED) return "Incident resolved";
  if (action === HistoryActionType.REOPENED) return "Incident reopened";
  if (action === HistoryActionType.CLOSED) return "Incident closed";
  if (action === HistoryActionType.CANCELLED) return "Incident cancelled";
  if (action === HistoryActionType.ASSIGNED || action === HistoryActionType.REASSIGNED) return `Assignment updated`;
  if (action === HistoryActionType.NOTE_ADDED) return newValue === NoteType.WORK_NOTE ? "Work note added" : "Additional comment added";
  if (action === HistoryActionType.ATTACHMENT_ADDED) return `Attachment added: ${newValue ?? ""}`;
  if (action === HistoryActionType.ATTACHMENT_REMOVED) return `Attachment removed: ${oldValue ?? ""}`;
  return `${fieldName} updated`;
}
