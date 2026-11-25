import { IncidentStatus, RoleName } from "../../../generated/prisma/client";
import { AuthenticatedUser } from "../../../common/auth/authenticated-user";
import { isTerminalStatus } from "./incident-rules";

export interface IncidentAccessRecord {
  status: IncidentStatus;
  assignedToId: string | null;
  assignmentGroupId: string | null;
  createdById: string;
  callerId: string | null;
}

export interface IncidentPermissions {
  canEdit: boolean;
  canAssign: boolean;
  canUpdateStatus: boolean;
  canResolve: boolean;
  canClose: boolean;
  canCancel: boolean;
  canAddWorkNote: boolean;
  canAddComment: boolean;
  canUpload: boolean;
}

export function hasRole(user: AuthenticatedUser, role: RoleName): boolean {
  return user.roles.includes(role);
}

export function isPrivileged(user: AuthenticatedUser): boolean {
  return hasRole(user, RoleName.ITSM_ADMINISTRATOR) || hasRole(user, RoleName.INCIDENT_MANAGER);
}

export function isRequesterOnly(user: AuthenticatedUser): boolean {
  return hasRole(user, RoleName.REQUESTER) && !isPrivileged(user) && !hasRole(user, RoleName.SUPPORT_AGENT);
}

export function canSeeWorkNotes(user: AuthenticatedUser): boolean {
  return (
    isPrivileged(user) ||
    hasRole(user, RoleName.SUPPORT_AGENT) ||
    hasRole(user, RoleName.READ_ONLY)
  );
}

export function canCreateIncident(user: AuthenticatedUser): boolean {
  return (
    isPrivileged(user) ||
    hasRole(user, RoleName.SUPPORT_AGENT) ||
    hasRole(user, RoleName.REQUESTER)
  );
}

export function canViewIncident(user: AuthenticatedUser, incident: IncidentAccessRecord): boolean {
  if (isPrivileged(user) || hasRole(user, RoleName.READ_ONLY)) return true;
  const owns = incident.createdById === user.id || incident.callerId === user.id;
  if (hasRole(user, RoleName.SUPPORT_AGENT)) {
    const inGroup = incident.assignmentGroupId !== null && user.groupIds.includes(incident.assignmentGroupId);
    return incident.assignedToId === user.id || inGroup || owns;
  }
  return owns;
}

function agentCanWork(user: AuthenticatedUser, incident: IncidentAccessRecord): boolean {
  const inGroup = incident.assignmentGroupId !== null && user.groupIds.includes(incident.assignmentGroupId);
  return incident.assignedToId === user.id || inGroup;
}

export function permissionsFor(user: AuthenticatedUser, incident: IncidentAccessRecord): IncidentPermissions {
  const visible = canViewIncident(user, incident);
  const terminal = isTerminalStatus(incident.status);
  const privileged = isPrivileged(user);
  const agent = hasRole(user, RoleName.SUPPORT_AGENT);
  const editable = visible && !terminal && (privileged || (agent && agentCanWork(user, incident)));
  const canResolve = visible && !terminal && (privileged || (agent && incident.assignedToId === user.id));
  const canClose = visible && !terminal && privileged;
  const canCancel =
    visible &&
    !terminal &&
    (privileged || (incident.status === IncidentStatus.NEW && (incident.createdById === user.id || incident.callerId === user.id)));
  const canAddWorkNote = visible && !terminal && (privileged || agent);
  const canAddComment =
    visible &&
    !terminal &&
    (privileged || agent || (hasRole(user, RoleName.REQUESTER) && (incident.createdById === user.id || incident.callerId === user.id)));

  return {
    canEdit: editable,
    canAssign: editable,
    canUpdateStatus: editable || canResolve || canClose || canCancel,
    canResolve,
    canClose,
    canCancel,
    canAddWorkNote,
    canAddComment,
    canUpload: canAddComment,
  };
}

export function canTransitionTo(
  user: AuthenticatedUser,
  incident: IncidentAccessRecord,
  next: IncidentStatus,
): boolean {
  const permissions = permissionsFor(user, incident);
  if (next === incident.status) return permissions.canEdit;
  if (next === IncidentStatus.RESOLVED) return permissions.canResolve;
  if (next === IncidentStatus.CLOSED) return permissions.canClose;
  if (next === IncidentStatus.CANCELLED) return permissions.canCancel;
  if (incident.status === IncidentStatus.RESOLVED && next === IncidentStatus.IN_PROGRESS) {
    return isPrivileged(user) || (hasRole(user, RoleName.SUPPORT_AGENT) && incident.assignedToId === user.id);
  }
  return permissions.canEdit;
}
