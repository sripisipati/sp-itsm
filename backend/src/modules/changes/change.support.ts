import { ConflictException, ForbiddenException, InternalServerErrorException } from "@nestjs/common";
import { Prisma, RoleName } from "../../generated/prisma/client";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";

const PREFIX: Record<string, string> = { CHANGE: "CHG", TASK: "CTASK", CAB: "CAB", PROBLEM: "PRB" };

export const EDITOR_ROLES: RoleName[] = [
  RoleName.ITSM_ADMINISTRATOR,
  RoleName.CHANGE_MANAGER,
  RoleName.CHANGE_REQUESTER,
  RoleName.CHANGE_OWNER,
  RoleName.IMPLEMENTATION_LEAD,
];

export const WORK_NOTE_ROLES: RoleName[] = [
  RoleName.ITSM_ADMINISTRATOR,
  RoleName.CHANGE_MANAGER,
  RoleName.CHANGE_OWNER,
  RoleName.TECHNICAL_APPROVER,
  RoleName.BUSINESS_APPROVER,
  RoleName.CAB_MEMBER,
  RoleName.IMPLEMENTATION_LEAD,
  RoleName.CHANGE_AUDITOR,
  RoleName.INCIDENT_MANAGER,
  RoleName.SUPPORT_AGENT,
];

export function hasRole(user: AuthenticatedUser, roles: string[]): boolean {
  return user.roles.some((role) => roles.includes(role));
}

export function assertEditor(user: AuthenticatedUser): void {
  if (!hasRole(user, EDITOR_ROLES)) throw new ForbiddenException("You cannot modify changes.");
}

export function canSeeWorkNotes(user: AuthenticatedUser): boolean {
  return hasRole(user, WORK_NOTE_ROLES);
}

export function person(user: { id: string; firstName: string; lastName: string; email?: string } | null | undefined) {
  if (!user) return null;
  return { id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email };
}

export async function allocateNumber(tx: Prisma.TransactionClient, key: string): Promise<string> {
  const prefix = PREFIX[key] ?? key;
  const rows = await tx.$queryRaw<Array<{ next_number: number }>>`
    UPDATE ticket_sequences
    SET next_number = next_number + 1
    WHERE prefix = ${prefix}
    RETURNING next_number
  `;
  const sequence = Number(rows[0]?.next_number);
  if (!Number.isInteger(sequence)) {
    throw new InternalServerErrorException(`${prefix} numbering is not configured.`);
  }
  return `${prefix}${String(sequence).padStart(7, "0")}`;
}

export async function updateVersioned(
  tx: Prisma.TransactionClient,
  id: string,
  version: number,
  data: Prisma.ChangeRequestUncheckedUpdateManyInput,
): Promise<void> {
  const result = await tx.changeRequest.updateMany({
    where: { id, version },
    data: { ...data, version: { increment: 1 } },
  });
  if (result.count !== 1) {
    throw new ConflictException("This change was updated by someone else. Reload and try again.");
  }
}

export async function recordHistory(
  tx: Prisma.TransactionClient,
  input: {
    changeId: string;
    userId: string;
    action: string;
    correlationId?: string;
    comment?: string | null;
    entries?: { field: string | null; oldValue: string | null; newValue: string | null }[];
  },
): Promise<void> {
  const entries = input.entries?.length ? input.entries : [{ field: null, oldValue: null, newValue: null }];
  await tx.changeHistory.createMany({
    data: entries.map((entry) => ({
      changeId: input.changeId,
      userId: input.userId,
      action: input.action,
      field: entry.field,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      comment: input.comment ?? null,
    })),
  });
  await tx.auditLog.createMany({
    data: entries.map((entry) => ({
      entityType: "CHANGE",
      entityId: input.changeId,
      action: input.action,
      field: entry.field,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      userId: input.userId,
      correlationId: input.correlationId ?? null,
    })),
  });
}

export async function notifyUsers(
  tx: Prisma.TransactionClient,
  userIds: Array<string | null | undefined>,
  event: { title: string; message: string; entityId: string },
): Promise<void> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return;
  await tx.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      title: event.title,
      body: event.message,
      link: `/changes/${event.entityId}`,
    })),
  });
}

export async function userIdsByRoles(tx: Prisma.TransactionClient, roles: RoleName[]): Promise<string[]> {
  if (!roles.length) return [];
  const rows = await tx.user.findMany({
    where: { isActive: true, roles: { some: { role: { name: { in: roles } } } } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export function asText(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
