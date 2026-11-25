import { BadRequestException } from "@nestjs/common";
import { IncidentStatus, Prisma, Priority, Severity } from "../../../generated/prisma/client";
import { AuthenticatedUser } from "../../../common/auth/authenticated-user";
import { isPrivileged } from "./incident-access";
import { RoleName } from "../../../generated/prisma/client";

const SORT_FIELDS = {
  ticketNumber: "ticketNumber",
  shortDescription: "shortDescription",
  description: "shortDescription",
  severity: "severity",
  priority: "priority",
  assignedOn: "assignedOn",
  status: "status",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
} as const;

export type IncidentSortField = (typeof SORT_FIELDS)[keyof typeof SORT_FIELDS];

export interface IncidentListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  ticketNumber?: string;
  description?: string;
  severity?: Severity;
  priority?: Priority;
  assignedTo?: string;
  assignedOnFrom?: string;
  assignedOnTo?: string;
  status?: string;
  createdBy?: string;
  createdOnFrom?: string;
  createdOnTo?: string;
  updatedBy?: string;
  updatedOnFrom?: string;
  updatedOnTo?: string;
  view?: "all" | "mine" | "unassigned";
}

function parseDateBound(value: string, endOfDay: boolean): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException("A filter date is invalid.");
  }
  return parsed;
}

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  const range: Prisma.DateTimeFilter = {};
  if (from) range.gte = parseDateBound(from, false);
  if (to) range.lte = parseDateBound(to, true);
  return range;
}

function parseStatuses(value?: string): IncidentStatus[] | undefined {
  if (!value) return undefined;
  const allowed = new Set(Object.values(IncidentStatus));
  const statuses = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (statuses.length === 0) return undefined;
  const invalid = statuses.filter((status) => !allowed.has(status as IncidentStatus));
  if (invalid.length > 0) {
    throw new BadRequestException("A status filter value is invalid.");
  }
  return statuses as IncidentStatus[];
}

export function scopeWhere(user: AuthenticatedUser): Prisma.IncidentWhereInput {
  if (isPrivileged(user) || user.roles.includes(RoleName.READ_ONLY)) return {};
  if (user.roles.includes(RoleName.SUPPORT_AGENT)) {
    return {
      OR: [
        { assignedToId: user.id },
        { assignmentGroupId: { in: user.groupIds } },
        { createdById: user.id },
        { callerId: user.id },
      ],
    };
  }
  return { OR: [{ createdById: user.id }, { callerId: user.id }] };
}

export function buildIncidentWhere(query: IncidentListQuery, user: AuthenticatedUser): Prisma.IncidentWhereInput {
  const and: Prisma.IncidentWhereInput[] = [{ archivedAt: null }, scopeWhere(user)];
  if (query.view === "mine") and.push({ assignedToId: user.id });
  if (query.view === "unassigned") and.push({ assignedToId: null });
  if (query.search) {
    and.push({
      OR: [
        { ticketNumber: { contains: query.search, mode: "insensitive" } },
        { shortDescription: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ],
    });
  }
  if (query.ticketNumber) and.push({ ticketNumber: { contains: query.ticketNumber, mode: "insensitive" } });
  if (query.description) {
    and.push({
      OR: [
        { shortDescription: { contains: query.description, mode: "insensitive" } },
        { description: { contains: query.description, mode: "insensitive" } },
      ],
    });
  }
  if (query.severity) and.push({ severity: query.severity });
  if (query.priority) and.push({ priority: query.priority });
  if (query.assignedTo === "unassigned") and.push({ assignedToId: null });
  else if (query.assignedTo) and.push({ assignedToId: query.assignedTo });
  const assignedOn = dateRange(query.assignedOnFrom, query.assignedOnTo);
  if (assignedOn) and.push({ assignedOn });
  const statuses = parseStatuses(query.status);
  if (statuses) and.push({ status: { in: statuses } });
  if (query.createdBy) and.push({ createdById: query.createdBy });
  const createdOn = dateRange(query.createdOnFrom, query.createdOnTo);
  if (createdOn) and.push({ createdAt: createdOn });
  if (query.updatedBy) and.push({ updatedById: query.updatedBy });
  const updatedOn = dateRange(query.updatedOnFrom, query.updatedOnTo);
  if (updatedOn) and.push({ updatedAt: updatedOn });
  return { AND: and };
}

export function buildIncidentOrder(query: IncidentListQuery): Prisma.IncidentOrderByWithRelationInput {
  const field = SORT_FIELDS[query.sortBy as keyof typeof SORT_FIELDS] ?? "createdAt";
  return { [field]: query.sortOrder === "asc" ? "asc" : "desc" };
}
