import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { ChangeState, NoteType, Prisma } from "../../generated/prisma/client";
import { paginationMeta } from "../../common/pagination";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { PrismaService } from "../../database/prisma.service";
import { ChangeQueryDto, ConflictQueryDto, CreateChangeDto, PreviewDto, UpdateChangeDto } from "./change.dto";
import { buildWhere, listInclude, orderBy } from "./change.query";
import { ChangeRiskService } from "./change-risk.service";
import { allocateNumber, assertEditor, canSeeWorkNotes, person, recordHistory, updateVersioned } from "./change.support";

const EDITABLE: ChangeState[] = [
  ChangeState.DRAFT,
  ChangeState.SUBMITTED,
  ChangeState.ASSESSMENT,
  ChangeState.PENDING_APPROVAL,
  ChangeState.APPROVED,
  ChangeState.SCHEDULED,
  ChangeState.IMPLEMENTING,
  ChangeState.IMPLEMENTED,
  ChangeState.FAILED,
  ChangeState.REJECTED,
  ChangeState.DEFERRED,
  ChangeState.PENDING_REVIEW,
];

const detailInclude = {
  ...listInclude,
  requestedFor: { select: { id: true, firstName: true, lastName: true, email: true } },
  businessService: { select: { id: true, name: true } },
  configurationItem: { select: { id: true, name: true } },
  relatedIncident: { select: { id: true, ticketNumber: true, shortDescription: true, status: true } },
  relatedProblem: { select: { id: true, number: true, shortDescription: true, state: true } },
  subcategory: { select: { id: true, name: true } },
  changeOwner: { select: { id: true, firstName: true, lastName: true, email: true } },
  implementationLead: { select: { id: true, firstName: true, lastName: true, email: true } },
  changeCoordinator: { select: { id: true, firstName: true, lastName: true, email: true } },
  implementationGroup: { select: { id: true, name: true } },
  rollbackOwner: { select: { id: true, firstName: true, lastName: true, email: true } },
  affectedCis: { include: { configurationItem: { select: { id: true, name: true } } } },
  affectedServices: { include: { businessService: { select: { id: true, name: true } } } },
  tasks: { include: { assignee: { select: { id: true, firstName: true, lastName: true } }, dependencies: true }, orderBy: { number: "asc" as const } },
  testCases: { include: { owner: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" as const } },
  approvals: { include: { approver: { select: { id: true, firstName: true, lastName: true, email: true } }, delegatedTo: { select: { id: true, firstName: true, lastName: true, email: true } }, decidedBy: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { sequence: "asc" as const } },
  notes: { include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: "asc" as const } },
  pir: { include: { conductedBy: { select: { id: true, firstName: true, lastName: true } }, actions: true } },
  attachments: { include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { uploadedAt: "desc" as const } },
} satisfies Prisma.ChangeRequestInclude;

@Injectable()
export class ChangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly risk: ChangeRiskService,
  ) {}

  async list(query: ChangeQueryDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = buildWhere(query, user);
    const [totalRecords, rows] = await this.prisma.$transaction([
      this.prisma.changeRequest.count({ where }),
      this.prisma.changeRequest.findMany({ where, include: listInclude, orderBy: orderBy(query), skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { data: rows.map(mapListItem), pagination: paginationMeta(page, pageSize, totalRecords) };
  }

  async exportCsv(query: ChangeQueryDto, user: AuthenticatedUser): Promise<{ csv: string; truncated: boolean }> {
    const where = buildWhere(query, user);
    const rows = await this.prisma.changeRequest.findMany({ where, include: listInclude, orderBy: orderBy(query), take: 5001 });
    const truncated = rows.length > 5000;
    const slice = rows.slice(0, 5000);
    const header = ["Change Number", "Short Description", "Type", "Category", "Risk", "Impact", "Priority", "Requested By", "Assigned To", "Assignment Group", "Approval Status", "State", "Planned Start", "Planned End", "Created By", "Created On", "Updated By", "Updated On"];
    const lines = slice.map((row) =>
      [
        row.number,
        row.shortDescription,
        row.type,
        row.category?.name ?? "",
        row.riskLevel ?? "",
        row.businessImpact ?? "",
        row.priority ?? "",
        person(row.requestedBy)?.name ?? "",
        person(row.assignedTo)?.name ?? "",
        row.assignmentGroup?.name ?? "",
        row.approvalStatus,
        row.state,
        row.plannedStart?.toISOString() ?? "",
        row.plannedEnd?.toISOString() ?? "",
        person(row.createdBy)?.name ?? "",
        row.createdAt.toISOString(),
        person(row.updatedBy)?.name ?? "",
        row.updatedAt.toISOString(),
      ].map(csvCell).join(","),
    );
    return { csv: [header.join(","), ...lines].join("\n"), truncated };
  }

  async summary() {
    const states = Object.values(ChangeState);
    const counts = await Promise.all(states.map((state) => this.prisma.changeRequest.count({ where: { state } })));
    const byState = states.map((state, index) => ({ state, count: counts[index] }));
    const card = (state: ChangeState) => byState.find((row) => row.state === state)?.count ?? 0;
    const [byType, byRisk, byGroup, recent, upcoming, outcomes] = await Promise.all([
      this.prisma.changeRequest.groupBy({ by: ["type"], _count: { _all: true } }),
      this.prisma.changeRequest.groupBy({ by: ["riskLevel"], _count: { _all: true } }),
      this.prisma.changeRequest.groupBy({ by: ["assignmentGroupId"], _count: { _all: true } }),
      this.prisma.changeRequest.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: listInclude }),
      this.prisma.changeRequest.findMany({
        where: { state: { in: [ChangeState.SCHEDULED, ChangeState.APPROVED] }, plannedStart: { gte: new Date() } },
        orderBy: { plannedStart: "asc" },
        take: 8,
        include: listInclude,
      }),
      this.prisma.changeRequest.groupBy({ by: ["implementationOutcome"], _count: { _all: true } }),
    ]);
    const groups = await this.prisma.assignmentGroup.findMany({ select: { id: true, name: true } });
    const months = await this.prisma.$queryRaw<Array<{ month: Date; count: bigint }>>`
      SELECT date_trunc('month', created_at) AS month, COUNT(*)::bigint AS count
      FROM change_requests
      WHERE created_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
      GROUP BY 1 ORDER BY 1
    `;
    const outcome = (name: string) => Number(outcomes.find((row) => row.implementationOutcome === name)?._count._all ?? 0);
    return {
      data: {
        cards: {
          total: counts.reduce((sum, count) => sum + count, 0),
          draft: card(ChangeState.DRAFT),
          pendingApproval: card(ChangeState.PENDING_APPROVAL),
          approved: card(ChangeState.APPROVED),
          scheduled: card(ChangeState.SCHEDULED),
          implementing: card(ChangeState.IMPLEMENTING),
          failed: card(ChangeState.FAILED),
          closed: card(ChangeState.CLOSED),
        },
        byStatus: byState,
        byType: byType.map((row) => ({ type: row.type, count: row._count._all })),
        byRisk: byRisk.map((row) => ({ risk: row.riskLevel, count: row._count._all })),
        byAssignmentGroup: byGroup.map((row) => ({
          groupId: row.assignmentGroupId,
          groupName: groups.find((group) => group.id === row.assignmentGroupId)?.name ?? "Unassigned",
          count: row._count._all,
        })),
        byMonth: months.map((row) => ({ month: row.month, count: Number(row.count) })),
        successVsFailed: { success: outcome("SUCCESS"), partial: outcome("PARTIAL"), failed: outcome("FAILURE") },
        recent: recent.map(mapListItem),
        upcoming: upcoming.map(mapListItem),
      },
    };
  }

  async calendar(from: string, to: string) {
    const start = new Date(from);
    const end = new Date(to);
    const [changes, maintenanceWindows, blackoutPeriods] = await Promise.all([
      this.prisma.changeRequest.findMany({
        where: { plannedStart: { lt: end }, plannedEnd: { gt: start } },
        select: { id: true, number: true, shortDescription: true, state: true, type: true, riskLevel: true, plannedStart: true, plannedEnd: true, configurationItemId: true, businessServiceId: true },
        orderBy: { plannedStart: "asc" },
      }),
      this.prisma.maintenanceWindow.findMany({ where: { startAt: { lt: end }, endAt: { gt: start } }, orderBy: { startAt: "asc" } }),
      this.prisma.blackoutPeriod.findMany({ where: { startAt: { lt: end }, endAt: { gt: start } }, orderBy: { startAt: "asc" } }),
    ]);
    return { data: { changes, maintenanceWindows, blackoutPeriods } };
  }

  async conflicts(query: ConflictQueryDto) {
    const result = await this.prisma.$transaction((tx) =>
      findConflicts(tx, {
        plannedStart: new Date(query.plannedStart),
        plannedEnd: new Date(query.plannedEnd),
        configurationItemId: query.configurationItemId,
        businessServiceId: query.businessServiceId,
        affectedCiIds: query.affectedCiIds,
        affectedServiceIds: query.affectedServiceIds,
        excludeChangeId: query.excludeChangeId,
      }),
    );
    return { data: result };
  }

  preview(dto: PreviewDto) {
    return this.prisma.$transaction(async (tx) => ({
      data: await this.risk.calculate(tx, { ...dto, downtimeRequired: dto.downtimeRequired ?? false, impactedUsers: dto.impactedUsers ?? 0 }),
    }));
  }

  async create(dto: CreateChangeDto, user: AuthenticatedUser, correlationId?: string) {
    assertEditor(user);
    const id = await this.prisma.$transaction(async (tx) => {
      const template = dto.templateId ? await tx.changeTemplate.findUnique({ where: { id: dto.templateId } }) : null;
      if (dto.templateId && (!template || !template.isActive)) throw new BadRequestException("Change template not found");
      await this.assertLinks(tx, dto);
      const number = await allocateNumber(tx, "CHANGE");
      const computed = await this.risk.calculate(tx, {
        type: dto.type,
        businessImpact: dto.businessImpact,
        technicalImpact: dto.technicalImpact,
        urgency: dto.urgency,
        probability: dto.probability,
        downtimeRequired: dto.downtimeRequired ?? false,
        impactedUsers: dto.impactedUsers ?? 0,
      });
      const created = await tx.changeRequest.create({
        data: {
          number,
          shortDescription: dto.shortDescription.trim(),
          description: dto.description.trim() || template?.description || "",
          type: dto.type,
          categoryId: dto.categoryId ?? template?.categoryId,
          subcategoryId: dto.subcategoryId,
          requestedById: dto.requestedById ?? user.id,
          requestedForId: dto.requestedForId,
          businessJustification: dto.businessJustification,
          businessServiceId: dto.businessServiceId,
          configurationItemId: dto.configurationItemId,
          relatedIncidentId: dto.relatedIncidentId,
          relatedProblemId: dto.relatedProblemId,
          businessImpact: dto.businessImpact,
          technicalImpact: dto.technicalImpact,
          urgency: dto.urgency,
          priority: computed.priority,
          probability: dto.probability,
          impactedUsers: dto.impactedUsers,
          downtimeRequired: dto.downtimeRequired ?? false,
          estimatedDowntimeMinutes: dto.estimatedDowntimeMinutes,
          riskAssessmentNarrative: dto.riskAssessmentNarrative,
          impactAnalysis: dto.impactAnalysis ?? template?.implementationPlan,
          plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : undefined,
          plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : undefined,
          maintenanceWindowId: dto.maintenanceWindowId,
          implementationGroupId: dto.implementationGroupId,
          changeOwnerId: dto.changeOwnerId,
          implementationLeadId: dto.implementationLeadId,
          changeCoordinatorId: dto.changeCoordinatorId,
          assignmentGroupId: dto.assignmentGroupId,
          assignedToId: dto.assignedToId,
          backoutRequired: dto.backoutRequired ?? computed.rollbackRequired,
          backoutPlan: dto.backoutPlan ?? template?.backoutPlan,
          backoutTriggerConditions: dto.backoutTriggerConditions,
          rollbackSteps: dto.rollbackSteps,
          rollbackDurationMinutes: dto.rollbackDurationMinutes,
          rollbackOwnerId: dto.rollbackOwnerId,
          pirRequired: computed.pirRequired,
          emergencyJustification: dto.emergencyJustification,
          testPlan: dto.testPlan,
          templateId: dto.templateId,
          riskLevel: computed.level,
          riskScore: computed.score,
          riskExplanation: JSON.stringify({ summary: computed.summary, factors: computed.factors }),
          createdById: user.id,
          updatedById: user.id,
        },
      });
      await replaceLinks(tx, created.id, dto.affectedCiIds, dto.affectedServiceIds);
      await recordHistory(tx, { changeId: created.id, userId: user.id, action: "CREATE", correlationId, comment: created.number });
      return created.id;
    });
    return this.get(id, user);
  }

  async update(id: string, dto: UpdateChangeDto, user: AuthenticatedUser, correlationId?: string) {
    assertEditor(user);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.changeRequest.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException("Change not found");
      if (!EDITABLE.includes(existing.state)) throw new BadRequestException("This change can no longer be edited");
      if (dto.plannedStart && dto.plannedEnd && new Date(dto.plannedEnd) <= new Date(dto.plannedStart)) {
        throw new BadRequestException("Planned end must be after planned start");
      }
      await this.assertLinks(tx, dto);
      const computed = await this.risk.calculate(tx, {
        type: dto.type,
        businessImpact: dto.businessImpact,
        technicalImpact: dto.technicalImpact,
        urgency: dto.urgency,
        probability: dto.probability,
        downtimeRequired: dto.downtimeRequired ?? false,
        impactedUsers: dto.impactedUsers ?? 0,
      });
      await updateVersioned(tx, id, dto.version, {
        shortDescription: dto.shortDescription.trim(),
        description: dto.description.trim(),
        type: dto.type,
        categoryId: dto.categoryId ?? null,
        subcategoryId: dto.subcategoryId ?? null,
        requestedById: dto.requestedById ?? existing.requestedById,
        requestedForId: dto.requestedForId ?? null,
        businessJustification: dto.businessJustification ?? null,
        businessServiceId: dto.businessServiceId ?? null,
        configurationItemId: dto.configurationItemId ?? null,
        relatedIncidentId: dto.relatedIncidentId ?? null,
        relatedProblemId: dto.relatedProblemId ?? null,
        businessImpact: dto.businessImpact ?? null,
        technicalImpact: dto.technicalImpact ?? null,
        urgency: dto.urgency ?? null,
        priority: computed.priority,
        probability: dto.probability ?? null,
        impactedUsers: dto.impactedUsers ?? null,
        downtimeRequired: dto.downtimeRequired ?? false,
        estimatedDowntimeMinutes: dto.estimatedDowntimeMinutes ?? null,
        riskAssessmentNarrative: dto.riskAssessmentNarrative ?? null,
        impactAnalysis: dto.impactAnalysis ?? null,
        assessmentSummary: dto.assessmentSummary ?? null,
        plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : null,
        plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : null,
        actualStart: dto.actualStart ? new Date(dto.actualStart) : null,
        actualEnd: dto.actualEnd ? new Date(dto.actualEnd) : null,
        maintenanceWindowId: dto.maintenanceWindowId ?? null,
        implementationGroupId: dto.implementationGroupId ?? null,
        changeOwnerId: dto.changeOwnerId ?? null,
        implementationLeadId: dto.implementationLeadId ?? null,
        changeCoordinatorId: dto.changeCoordinatorId ?? null,
        assignmentGroupId: dto.assignmentGroupId ?? null,
        assignedToId: dto.assignedToId ?? null,
        implementationStatus: dto.implementationStatus ?? null,
        implementationSummary: dto.implementationSummary ?? null,
        implementationOutcome: dto.implementationOutcome ?? null,
        serviceImpactSummary: dto.serviceImpactSummary ?? null,
        issuesEncountered: dto.issuesEncountered ?? null,
        rollbackExecuted: dto.rollbackExecuted ?? false,
        resolutionDetails: dto.resolutionDetails ?? null,
        backoutRequired: dto.backoutRequired ?? computed.rollbackRequired,
        backoutPlan: dto.backoutPlan ?? null,
        backoutTriggerConditions: dto.backoutTriggerConditions ?? null,
        rollbackSteps: dto.rollbackSteps ?? null,
        rollbackDurationMinutes: dto.rollbackDurationMinutes ?? null,
        rollbackOwnerId: dto.rollbackOwnerId ?? null,
        emergencyJustification: dto.emergencyJustification ?? null,
        testPlan: dto.testPlan ?? null,
        pirRequired: computed.pirRequired,
        riskLevel: computed.level,
        riskScore: computed.score,
        riskExplanation: JSON.stringify({ summary: computed.summary, factors: computed.factors }),
        updatedById: user.id,
      });
      await replaceLinks(tx, id, dto.affectedCiIds, dto.affectedServiceIds);
      await recordHistory(tx, {
        changeId: id,
        userId: user.id,
        action: "UPDATE",
        correlationId,
        entries: [{ field: "shortDescription", oldValue: existing.shortDescription, newValue: dto.shortDescription }],
      });
    });
    return this.get(id, user);
  }

  async get(id: string, user: AuthenticatedUser) {
    const row = await this.prisma.changeRequest.findUnique({ where: { id }, include: detailInclude });
    if (!row) throw new NotFoundException("Change not found");
    const seeNotes = canSeeWorkNotes(user);
    const completed = row.tasks.filter((task) => task.status === "COMPLETED").length;
    return {
      data: {
        ...row,
        requestedBy: person(row.requestedBy),
        requestedFor: person(row.requestedFor),
        assignedTo: person(row.assignedTo),
        changeOwner: person(row.changeOwner),
        implementationLead: person(row.implementationLead),
        changeCoordinator: person(row.changeCoordinator),
        createdBy: person(row.createdBy),
        updatedBy: person(row.updatedBy),
        rollbackOwner: person(row.rollbackOwner),
        notes: row.notes.filter((note) => seeNotes || note.noteType !== NoteType.WORK_NOTE).map((note) => ({ ...note, author: person(note.author) })),
        risk: row.riskExplanation ? safeJson(row.riskExplanation) : null,
        taskProgress: { total: row.tasks.length, completed, percent: row.tasks.length ? Math.round((completed / row.tasks.length) * 100) : 0 },
      },
    };
  }

  private async assertLinks(tx: Prisma.TransactionClient, dto: CreateChangeDto): Promise<void> {
    if (dto.relatedIncidentId && !(await tx.incident.findUnique({ where: { id: dto.relatedIncidentId } }))) {
      throw new BadRequestException("Related incident was not found");
    }
    if (dto.relatedProblemId && !(await tx.problem.findUnique({ where: { id: dto.relatedProblemId } }))) {
      throw new BadRequestException("Related problem was not found");
    }
  }
}

export async function findConflicts(
  tx: Prisma.TransactionClient,
  input: {
    plannedStart: Date;
    plannedEnd: Date;
    configurationItemId?: string | null;
    businessServiceId?: string | null;
    affectedCiIds?: string[];
    affectedServiceIds?: string[];
    excludeChangeId?: string;
  },
) {
  if (input.plannedEnd <= input.plannedStart) throw new BadRequestException("Planned end must be after planned start");
  const ciIds = [...new Set([input.configurationItemId, ...(input.affectedCiIds ?? [])].filter((id): id is string => Boolean(id)))];
  const serviceIds = [...new Set([input.businessServiceId, ...(input.affectedServiceIds ?? [])].filter((id): id is string => Boolean(id)))];
  const conflicts: Array<{ kind: string; message: string; changeId?: string; number?: string }> = [];
  const warnings: Array<{ kind: string; message: string }> = [];
  if (ciIds.length || serviceIds.length) {
    const or: Prisma.ChangeRequestWhereInput[] = [];
    if (ciIds.length) {
      or.push({ configurationItemId: { in: ciIds } });
      or.push({ affectedCis: { some: { configurationItemId: { in: ciIds } } } });
    }
    if (serviceIds.length) {
      or.push({ businessServiceId: { in: serviceIds } });
      or.push({ affectedServices: { some: { businessServiceId: { in: serviceIds } } } });
    }
    const overlaps = await tx.changeRequest.findMany({
      where: {
        id: input.excludeChangeId ? { not: input.excludeChangeId } : undefined,
        state: { in: [ChangeState.APPROVED, ChangeState.SCHEDULED, ChangeState.IMPLEMENTING] },
        plannedStart: { lt: input.plannedEnd },
        plannedEnd: { gt: input.plannedStart },
        OR: or,
      },
      select: { id: true, number: true, shortDescription: true },
    });
    for (const row of overlaps) {
      conflicts.push({ kind: "OVERLAP", message: `${row.number} already occupies this CI or service`, changeId: row.id, number: row.number });
    }
    const blackouts = await tx.blackoutPeriod.findMany({
      where: {
        startAt: { lt: input.plannedEnd },
        endAt: { gt: input.plannedStart },
        OR: [
          ...(ciIds.length ? [{ configurationItemId: { in: ciIds } }] : []),
          ...(serviceIds.length ? [{ businessServiceId: { in: serviceIds } }] : []),
        ],
      },
    });
    for (const row of blackouts) conflicts.push({ kind: "BLACKOUT", message: `Blackout period ${row.name}` });
  }
  if (ciIds.length || serviceIds.length) {
    const windows = await tx.maintenanceWindow.findMany({
      where: {
        OR: [
          ...(ciIds.length ? [{ configurationItemId: { in: ciIds } }] : []),
          ...(serviceIds.length ? [{ businessServiceId: { in: serviceIds } }] : []),
        ],
      },
    });
    const inside = windows.some((window) => window.startAt <= input.plannedStart && window.endAt >= input.plannedEnd);
    if (windows.length && !inside) warnings.push({ kind: "MAINTENANCE_WINDOW", message: "The planned window is outside the maintenance windows for this CI or service." });
  }
  return { conflicts, warnings };
}

export async function assertCanSchedule(
  tx: Prisma.TransactionClient,
  change: { id: string; plannedStart: Date | null; plannedEnd: Date | null; configurationItemId: string | null; businessServiceId: string | null },
  override: { justification?: string; authorized: boolean },
) {
  if (!change.plannedStart || !change.plannedEnd) throw new BadRequestException("A planned start and end are required before scheduling");
  const affected = await tx.changeRequest.findUnique({
    where: { id: change.id },
    select: { affectedCis: true, affectedServices: true },
  });
  const result = await findConflicts(tx, {
    plannedStart: change.plannedStart,
    plannedEnd: change.plannedEnd,
    configurationItemId: change.configurationItemId,
    businessServiceId: change.businessServiceId,
    affectedCiIds: affected?.affectedCis.map((row) => row.configurationItemId),
    affectedServiceIds: affected?.affectedServices.map((row) => row.businessServiceId),
    excludeChangeId: change.id,
  });
  if (result.conflicts.length && !override.justification) {
    throw new UnprocessableEntityException({ message: "Scheduling conflicts must be overridden with a justification.", conflicts: result.conflicts, warnings: result.warnings });
  }
  if (result.conflicts.length && !override.authorized) {
    throw new ForbiddenException("You are not authorized to override a scheduling conflict.");
  }
  return result;
}

async function replaceLinks(tx: Prisma.TransactionClient, changeId: string, ciIds?: string[], serviceIds?: string[]) {
  if (ciIds) {
    await tx.changeAffectedCi.deleteMany({ where: { changeId } });
    if (ciIds.length) await tx.changeAffectedCi.createMany({ data: ciIds.map((configurationItemId) => ({ changeId, configurationItemId })) });
  }
  if (serviceIds) {
    await tx.changeAffectedService.deleteMany({ where: { changeId } });
    if (serviceIds.length) await tx.changeAffectedService.createMany({ data: serviceIds.map((businessServiceId) => ({ changeId, businessServiceId })) });
  }
}

function mapListItem(row: Prisma.ChangeRequestGetPayload<{ include: typeof listInclude }>) {
  return {
    id: row.id,
    number: row.number,
    shortDescription: row.shortDescription,
    type: row.type,
    category: row.category,
    riskLevel: row.riskLevel,
    businessImpact: row.businessImpact,
    priority: row.priority,
    requestedBy: person(row.requestedBy),
    assignedTo: person(row.assignedTo),
    assignmentGroup: row.assignmentGroup,
    approvalStatus: row.approvalStatus,
    state: row.state,
    plannedStart: row.plannedStart,
    plannedEnd: row.plannedEnd,
    createdBy: person(row.createdBy),
    createdAt: row.createdAt,
    updatedBy: person(row.updatedBy),
    updatedAt: row.updatedAt,
    version: row.version,
  };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { summary: value };
  }
}
