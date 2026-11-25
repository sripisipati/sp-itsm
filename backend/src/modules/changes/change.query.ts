import { ChangeState, Prisma, RoleName } from "../../generated/prisma/client";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { ChangeQueryDto, SORT_FIELDS } from "./change.dto";

const userSelect = { id: true, firstName: true, lastName: true, email: true } as const;

export const listInclude = {
  requestedBy: { select: userSelect },
  assignedTo: { select: userSelect },
  assignmentGroup: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  createdBy: { select: userSelect },
  updatedBy: { select: userSelect },
} satisfies Prisma.ChangeRequestInclude;

function bound(value: string | undefined, end: boolean): Date | undefined {
  if (!value) return undefined;
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T23:59:59.999Z`);
  return new Date(value);
}

export function buildWhere(query: ChangeQueryDto, user: AuthenticatedUser): Prisma.ChangeRequestWhereInput {
  const where: Prisma.ChangeRequestWhereInput = {};
  const and: Prisma.ChangeRequestWhereInput[] = [];
  if (query.search) {
    and.push({
      OR: [
        { number: { contains: query.search, mode: "insensitive" } },
        { shortDescription: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ],
    });
  }
  if (query.number) where.number = { contains: query.number, mode: "insensitive" };
  if (query.shortDescription) where.shortDescription = { contains: query.shortDescription, mode: "insensitive" };
  if (query.type) where.type = query.type;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.riskLevel) where.riskLevel = query.riskLevel;
  if (query.impact) where.businessImpact = query.impact;
  if (query.priority) where.priority = query.priority as Prisma.EnumChangePriorityFilter["equals"];
  if (query.requestedById) where.requestedById = query.requestedById;
  if (query.assignedToId) where.assignedToId = query.assignedToId;
  if (query.assignmentGroupId) where.assignmentGroupId = query.assignmentGroupId;
  if (query.approvalStatus) where.approvalStatus = query.approvalStatus as Prisma.EnumChangeApprovalStatusFilter["equals"];
  if (query.state?.length) where.state = { in: query.state };
  if (query.plannedStartFrom || query.plannedStartTo) {
    where.plannedStart = { gte: bound(query.plannedStartFrom, false), lte: bound(query.plannedStartTo, true) };
  }
  if (query.plannedEndFrom || query.plannedEndTo) {
    where.plannedEnd = { gte: bound(query.plannedEndFrom, false), lte: bound(query.plannedEndTo, true) };
  }
  if (query.createdById) where.createdById = query.createdById;
  if (query.createdFrom || query.createdTo) {
    where.createdAt = { gte: bound(query.createdFrom, false), lte: bound(query.createdTo, true) };
  }
  if (query.updatedById) where.updatedById = query.updatedById;
  if (query.updatedFrom || query.updatedTo) {
    where.updatedAt = { gte: bound(query.updatedFrom, false), lte: bound(query.updatedTo, true) };
  }
  if (query.relatedIncidentId) where.relatedIncidentId = query.relatedIncidentId;
  if (query.relatedProblemId) where.relatedProblemId = query.relatedProblemId;
  if (query.view === "mine") {
    and.push({ OR: [{ requestedById: user.id }, { assignedToId: user.id }, { changeOwnerId: user.id }, { implementationLeadId: user.id }] });
  }
  if (query.view === "pending_approvals") {
    and.push({
      approvals: {
        some: {
          status: "PENDING",
          OR: [
            { approverId: user.id },
            { delegatedToId: user.id },
            { approverId: null, delegatedToId: null, requiredRole: { in: user.roles as RoleName[] } },
          ],
        },
      },
    });
  }
  if (query.view === "scheduled") where.state = ChangeState.SCHEDULED;
  if (query.view === "emergency") where.type = "EMERGENCY";
  if (query.view === "closed") where.state = ChangeState.CLOSED;
  if (and.length) where.AND = and;
  return where;
}

export function orderBy(query: ChangeQueryDto): Prisma.ChangeRequestOrderByWithRelationInput {
  const direction = query.sortOrder === "asc" ? "asc" : "desc";
  const field = query.sortBy ?? "createdAt";
  if (!SORT_FIELDS.includes(field)) return { createdAt: "desc" };
  if (field === "category") return { category: { name: direction } };
  if (field === "requestedBy") return { requestedBy: { lastName: direction } };
  if (field === "assignedTo") return { assignedTo: { lastName: direction } };
  if (field === "assignmentGroup") return { assignmentGroup: { name: direction } };
  return { [field]: direction };
}
