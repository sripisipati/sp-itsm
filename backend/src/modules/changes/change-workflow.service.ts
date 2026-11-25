import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalDecisionStatus,
  ApprovalMode,
  ChangeApprovalStatus,
  ChangeState,
  ChangeType,
  ImplementationOutcome,
  NoteType,
  Prisma,
  RiskLevel,
  RoleName,
  TaskStatus,
  TestStatus,
} from "../../generated/prisma/client";
import { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { PrismaService } from "../../database/prisma.service";
import { AssessDto, AssignDto, CreateApprovalDto, DecisionDto, NoteDto, PirDto, StateDto, TaskDto, TestCaseDto } from "./change.dto";
import { assertCanSchedule } from "./changes.service";
import { allocateNumber, assertEditor, canSeeWorkNotes, hasRole, notifyUsers, person, recordHistory, updateVersioned, userIdsByRoles } from "./change.support";

const RANK: Record<string, number> = { VERY_LOW: 1, LOW: 2, MEDIUM: 3, HIGH: 4, VERY_HIGH: 5 };

@Injectable()
export class ChangeWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(id: string, version: number, user: AuthenticatedUser, correlationId?: string) {
    assertEditor(user);
    await this.prisma.$transaction(async (tx) => {
      const change = await this.load(tx, id);
      this.assertVersion(change.version, version);
      this.requireFields(change);
      await this.move(tx, change, ChangeState.SUBMITTED, user, correlationId);
      const policy = await tx.changeTypePolicy.findUnique({ where: { changeType: change.type } });
      const fresh = await this.load(tx, id);
      if (policy?.requiresAssessment) {
        await this.move(tx, fresh, ChangeState.ASSESSMENT, user, correlationId, true, false);
        await notifyUsers(tx, [change.requestedById, change.changeOwnerId], { title: "Change submitted", message: `${change.number} is in assessment`, entityId: id });
        return;
      }
      await this.instantiateApprovals(tx, fresh, user);
      const after = await this.load(tx, id);
      const next = after.approvals.length ? ChangeState.PENDING_APPROVAL : ChangeState.APPROVED;
      await this.move(tx, after, next, user, correlationId, true, false);
      await notifyUsers(tx, [change.requestedById, change.changeOwnerId], { title: "Change submitted", message: `${change.number} was submitted`, entityId: id });
    });
    return { data: { id } };
  }

  async assess(id: string, dto: AssessDto, user: AuthenticatedUser, correlationId?: string) {
    if (!hasRole(user, [RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER, RoleName.CHANGE_OWNER])) {
      throw new ForbiddenException("You cannot assess this change.");
    }
    await this.prisma.$transaction(async (tx) => {
      const change = await this.load(tx, id);
      if (change.state !== ChangeState.ASSESSMENT && change.state !== ChangeState.SUBMITTED) {
        throw new BadRequestException("This change is not awaiting assessment");
      }
      await updateVersioned(tx, id, dto.version, { assessmentSummary: dto.assessmentSummary ?? change.assessmentSummary, updatedById: user.id });
      await recordHistory(tx, { changeId: id, userId: user.id, action: "ASSESS", correlationId, comment: dto.assessmentSummary });
      if (dto.complete) {
        const fresh = await this.load(tx, id);
        if (fresh.state === ChangeState.SUBMITTED) await this.move(tx, fresh, ChangeState.ASSESSMENT, user, correlationId, true, false);
        const assessed = await this.load(tx, id);
        await this.instantiateApprovals(tx, assessed, user);
        const withApprovals = await this.load(tx, id);
        const next = withApprovals.approvals.length ? ChangeState.PENDING_APPROVAL : ChangeState.APPROVED;
        await this.move(tx, withApprovals, next, user, correlationId, true, false);
      }
    });
    return { data: { id } };
  }

  async transition(id: string, dto: StateDto, user: AuthenticatedUser, correlationId?: string) {
    await this.prisma.$transaction(async (tx) => {
      const change = await this.load(tx, id);
      const rule = await tx.changeStateRule.findFirst({ where: { fromState: change.state, toState: dto.toState, isActive: true } });
      if (!rule) throw new BadRequestException(`Cannot move from ${change.state} to ${dto.toState}`);
      const allowed = rule.allowedRoles.split("|").filter(Boolean);
      if (!hasRole(user, allowed)) throw new ForbiddenException("You cannot perform this state change.");
      await this.guard(tx, change, rule.guard, dto, user);
      const data: Prisma.ChangeRequestUncheckedUpdateManyInput = { state: dto.toState, updatedById: user.id };
      if (dto.implementationOutcome) data.implementationOutcome = dto.implementationOutcome;
      if (dto.rollbackExecuted != null) data.rollbackExecuted = dto.rollbackExecuted;
      if (dto.toState === ChangeState.IMPLEMENTING && !change.actualStart) data.actualStart = new Date();
      if ((dto.toState === ChangeState.IMPLEMENTED || dto.toState === ChangeState.FAILED) && !change.actualEnd) data.actualEnd = new Date();
      if (dto.toState === ChangeState.APPROVED) data.approvalStatus = ChangeApprovalStatus.APPROVED;
      if (dto.toState === ChangeState.REJECTED) data.approvalStatus = ChangeApprovalStatus.REJECTED;
      if (dto.toState === ChangeState.PENDING_APPROVAL) data.approvalStatus = ChangeApprovalStatus.PENDING;
      await updateVersioned(tx, id, dto.version, data);
      await recordHistory(tx, {
        changeId: id,
        userId: user.id,
        action: "STATE",
        correlationId,
        comment: dto.justification,
        entries: [{ field: "state", oldValue: change.state, newValue: dto.toState }],
      });
      await this.notifyState(tx, change, dto.toState);
    });
    return { data: { id } };
  }

  async assign(id: string, dto: AssignDto, user: AuthenticatedUser, correlationId?: string) {
    if (!hasRole(user, [RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER, RoleName.CHANGE_OWNER])) {
      throw new ForbiddenException("You cannot assign this change.");
    }
    await this.prisma.$transaction(async (tx) => {
      const change = await this.load(tx, id);
      await updateVersioned(tx, id, dto.version, {
        assignmentGroupId: dto.assignmentGroupId ?? null,
        assignedToId: dto.assignedToId ?? null,
        changeOwnerId: dto.changeOwnerId ?? change.changeOwnerId,
        implementationLeadId: dto.implementationLeadId ?? change.implementationLeadId,
        updatedById: user.id,
      });
      await recordHistory(tx, { changeId: id, userId: user.id, action: "ASSIGN", correlationId });
    });
    return { data: { id } };
  }

  async listApprovals(id: string) {
    const rows = await this.prisma.changeApproval.findMany({
      where: { changeId: id },
      include: {
        approver: { select: { id: true, firstName: true, lastName: true, email: true } },
        delegatedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        decidedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { sequence: "asc" },
    });
    return { data: rows.map((row) => ({ ...row, approver: person(row.approver), delegatedTo: person(row.delegatedTo), decidedBy: person(row.decidedBy) })) };
  }

  async addApproval(id: string, dto: CreateApprovalDto, user: AuthenticatedUser) {
    if (!hasRole(user, [RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER])) throw new ForbiddenException("You cannot add approvals.");
    const row = await this.prisma.changeApproval.create({
      data: {
        changeId: id,
        approvalType: dto.approvalType,
        sequence: dto.sequence,
        requiredRole: dto.requiredRole as RoleName,
        approverId: dto.approverId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
    });
    await this.prisma.changeRequest.update({ where: { id }, data: { approvalStatus: ChangeApprovalStatus.PENDING } });
    return { data: row };
  }

  async decide(id: string, approvalId: string, dto: DecisionDto, user: AuthenticatedUser, correlationId?: string) {
    await this.prisma.$transaction(async (tx) => {
      const change = await this.load(tx, id);
      const approval = change.approvals.find((row) => row.id === approvalId);
      if (!approval) throw new NotFoundException("Approval not found");
      if (approval.status !== ApprovalDecisionStatus.PENDING && approval.status !== ApprovalDecisionStatus.MORE_INFO) {
        throw new BadRequestException("This approval is already decided");
      }
      await this.assertCanDecide(tx, change, approval, user, dto);
      if (dto.decision === "DELEGATED") {
        if (!dto.delegateUserId) throw new BadRequestException("A delegate is required");
        const delegate = await tx.user.findFirst({ where: { id: dto.delegateUserId, isActive: true } });
        if (!delegate) throw new BadRequestException("Delegate was not found");
        await tx.changeApproval.update({
          where: { id: approvalId },
          data: { status: ApprovalDecisionStatus.PENDING, delegatedToId: dto.delegateUserId, comments: dto.comments, decidedById: user.id },
        });
        await recordHistory(tx, { changeId: id, userId: user.id, action: "DELEGATE", correlationId, comment: dto.comments });
        await notifyUsers(tx, [dto.delegateUserId], { title: "Approval delegated", message: `${change.number} was delegated to you`, entityId: id });
        await updateVersioned(tx, id, dto.version, { updatedById: user.id });
        return;
      }
      const status =
        dto.decision === "APPROVED" ? ApprovalDecisionStatus.APPROVED : dto.decision === "REJECTED" ? ApprovalDecisionStatus.REJECTED : ApprovalDecisionStatus.MORE_INFO;
      await tx.changeApproval.update({
        where: { id: approvalId },
        data: { status, comments: dto.comments, decidedById: user.id, decidedAt: new Date() },
      });
      await recordHistory(tx, { changeId: id, userId: user.id, action: `APPROVAL_${dto.decision}`, correlationId, comment: dto.comments });
      const remaining = await tx.changeApproval.findMany({ where: { changeId: id } });
      if (status === ApprovalDecisionStatus.REJECTED) {
        await updateVersioned(tx, id, dto.version, { state: ChangeState.REJECTED, approvalStatus: ChangeApprovalStatus.REJECTED, updatedById: user.id });
        await notifyUsers(tx, [change.requestedById, change.changeOwnerId], { title: "Change rejected", message: `${change.number} was rejected`, entityId: id });
        return;
      }
      const open = remaining.some((row) => row.id !== approvalId && (row.status === ApprovalDecisionStatus.PENDING || row.status === ApprovalDecisionStatus.MORE_INFO));
      const stillOpen = status !== ApprovalDecisionStatus.APPROVED || open;
      if (!stillOpen) {
        await updateVersioned(tx, id, dto.version, { state: ChangeState.APPROVED, approvalStatus: ChangeApprovalStatus.APPROVED, updatedById: user.id });
        await recordHistory(tx, { changeId: id, userId: user.id, action: "STATE", correlationId, entries: [{ field: "state", oldValue: change.state, newValue: ChangeState.APPROVED }] });
        await notifyUsers(tx, [change.requestedById, change.changeOwnerId], { title: "Change approved", message: `${change.number} is approved`, entityId: id });
        return;
      }
      await updateVersioned(tx, id, dto.version, { approvalStatus: ChangeApprovalStatus.PENDING, updatedById: user.id });
      if (status === ApprovalDecisionStatus.MORE_INFO) {
        await notifyUsers(tx, [change.requestedById], { title: "More information requested", message: `${change.number} needs more information`, entityId: id });
      }
    });
    return { data: { id } };
  }

  async escalate() {
    const due = await this.prisma.changeApproval.findMany({
      where: { status: ApprovalDecisionStatus.PENDING, dueAt: { lt: new Date() } },
      include: { change: true },
    });
    let count = 0;
    for (const approval of due) {
      const managers = await userIdsByRoles(this.prisma, [RoleName.CHANGE_MANAGER, RoleName.ITSM_ADMINISTRATOR]);
      await notifyUsers(this.prisma, managers, { title: "Approval overdue", message: `${approval.change.number} approval is past due`, entityId: approval.changeId });
      count += 1;
    }
    return { data: { escalated: count } };
  }

  async history(id: string) {
    const rows = await this.prisma.changeHistory.findMany({
      where: { changeId: id },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return { data: rows.map((row) => ({ ...row, user: person(row.user) })) };
  }

  async listTasks(id: string) {
    return { data: await this.prisma.changeTask.findMany({ where: { changeId: id }, include: { assignee: { select: { id: true, firstName: true, lastName: true } }, dependencies: true }, orderBy: { number: "asc" } }) };
  }

  async addTask(id: string, dto: TaskDto, user: AuthenticatedUser) {
    assertEditor(user);
    const task = await this.prisma.$transaction(async (tx) => {
      const number = await allocateNumber(tx, "TASK");
      const created = await tx.changeTask.create({
        data: {
          changeId: id,
          number,
          description: dto.description,
          instructions: dto.instructions,
          assigneeId: dto.assigneeId,
          assignmentGroupId: dto.assignmentGroupId,
          plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : null,
          plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : null,
          estimatedMinutes: dto.estimatedMinutes,
          status: dto.status ?? TaskStatus.PENDING,
        },
      });
      if (dto.dependsOnIds?.length) {
        await tx.changeTaskDependency.createMany({ data: dto.dependsOnIds.map((dependsOnId) => ({ taskId: created.id, dependsOnId })) });
      }
      return created;
    });
    return { data: task };
  }

  async updateTask(id: string, taskId: string, dto: TaskDto, user: AuthenticatedUser) {
    assertEditor(user);
    const existing = await this.prisma.changeTask.findFirst({ where: { id: taskId, changeId: id }, include: { dependencies: true } });
    if (!existing) throw new NotFoundException("Task not found");
    if (dto.status === TaskStatus.COMPLETED) {
      const deps = await this.prisma.changeTaskDependency.findMany({ where: { taskId }, include: { dependsOn: true } });
      if (deps.some((dep) => dep.dependsOn.status !== TaskStatus.COMPLETED)) {
        throw new BadRequestException("Dependent tasks must be completed first");
      }
      if (!dto.completionComments && !existing.completionComments) throw new BadRequestException("Completion comments are required");
    }
    const task = await this.prisma.changeTask.update({
      where: { id: taskId },
      data: {
        description: dto.description,
        instructions: dto.instructions,
        assigneeId: dto.assigneeId,
        assignmentGroupId: dto.assignmentGroupId,
        plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : undefined,
        plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : undefined,
        estimatedMinutes: dto.estimatedMinutes,
        actualStart: dto.actualStart ? new Date(dto.actualStart) : undefined,
        actualEnd: dto.actualEnd ? new Date(dto.actualEnd) : dto.status === TaskStatus.COMPLETED ? new Date() : undefined,
        status: dto.status,
        completionComments: dto.completionComments,
      },
    });
    return { data: task };
  }

  async listTests(id: string) {
    return { data: await this.prisma.changeTestCase.findMany({ where: { changeId: id }, orderBy: { createdAt: "asc" } }) };
  }

  async updateTest(id: string, testId: string, dto: TestCaseDto, user: AuthenticatedUser) {
    assertEditor(user);
    const existing = await this.prisma.changeTestCase.findFirst({ where: { id: testId, changeId: id } });
    if (!existing) throw new NotFoundException("Test case not found");
    const status = dto.status ?? existing.status;
    const actual = dto.actualResults ?? existing.actualResults ?? undefined;
    this.assertTest(status, actual ?? undefined);
    const row = await this.prisma.changeTestCase.update({
      where: { id: testId },
      data: {
        description: dto.description,
        expectedResults: dto.expectedResults,
        validationCriteria: dto.validationCriteria,
        ownerId: dto.ownerId,
        actualResults: actual,
        status,
      },
    });
    return { data: row };
  }

  async addTest(id: string, dto: TestCaseDto, user: AuthenticatedUser) {
    assertEditor(user);
    this.assertTest(dto.status ?? TestStatus.NOT_EXECUTED, dto.actualResults);
    const row = await this.prisma.changeTestCase.create({
      data: {
        changeId: id,
        description: dto.description,
        expectedResults: dto.expectedResults,
        validationCriteria: dto.validationCriteria,
        ownerId: dto.ownerId,
        actualResults: dto.actualResults,
        status: dto.status ?? TestStatus.NOT_EXECUTED,
      },
    });
    return { data: row };
  }

  async listNotes(id: string, user: AuthenticatedUser) {
    const rows = await this.prisma.changeNote.findMany({
      where: { changeId: id, ...(canSeeWorkNotes(user) ? {} : { noteType: { not: NoteType.WORK_NOTE } }) },
      include: { author: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return { data: rows.map((row) => ({ ...row, author: person(row.author) })) };
  }

  async addNote(id: string, dto: NoteDto, user: AuthenticatedUser, correlationId?: string) {
    if (dto.noteType === NoteType.WORK_NOTE && !canSeeWorkNotes(user)) throw new ForbiddenException("You cannot add internal work notes.");
    if (!hasRole(user, [...EDITOR_PLUS_APPROVERS])) throw new ForbiddenException("You cannot add notes.");
    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.changeNote.create({ data: { changeId: id, noteType: dto.noteType, content: dto.content, authorId: user.id } });
      await recordHistory(tx, { changeId: id, userId: user.id, action: "NOTE", correlationId, comment: dto.noteType });
      return created;
    });
    return { data: note };
  }

  async savePir(id: string, dto: PirDto, user: AuthenticatedUser, correlationId?: string) {
    if (!hasRole(user, [RoleName.ITSM_ADMINISTRATOR, RoleName.CHANGE_MANAGER, RoleName.CHANGE_OWNER, RoleName.IMPLEMENTATION_LEAD, RoleName.CHANGE_AUDITOR])) {
      throw new ForbiddenException("You cannot record a PIR.");
    }
    if (user.roles.length === 1 && user.roles[0] === RoleName.CHANGE_AUDITOR) throw new ForbiddenException("Auditors cannot edit a PIR.");
    await this.prisma.$transaction(async (tx) => {
      const pir = await tx.changePir.upsert({
        where: { changeId: id },
        create: {
          changeId: id,
          conductedById: dto.conductedById ?? user.id,
          conductedAt: dto.conductedAt ? new Date(dto.conductedAt) : new Date(),
          expectedVsActual: dto.expectedVsActual,
          disruption: dto.disruption,
          customerImpact: dto.customerImpact,
          successCriteriaMet: dto.successCriteriaMet,
          lessonsLearned: dto.lessonsLearned,
          result: dto.result,
        },
        update: {
          conductedById: dto.conductedById ?? user.id,
          conductedAt: dto.conductedAt ? new Date(dto.conductedAt) : new Date(),
          expectedVsActual: dto.expectedVsActual,
          disruption: dto.disruption,
          customerImpact: dto.customerImpact,
          successCriteriaMet: dto.successCriteriaMet,
          lessonsLearned: dto.lessonsLearned,
          result: dto.result,
        },
      });
      if (dto.actions) {
        await tx.pirAction.deleteMany({ where: { pirId: pir.id } });
        if (dto.actions.length) {
          await tx.pirAction.createMany({
            data: dto.actions.map((action) => ({ pirId: pir.id, description: action.description, ownerId: action.ownerId, dueAt: action.dueAt ? new Date(action.dueAt) : null })),
          });
        }
      }
      await updateVersioned(tx, id, dto.version, { updatedById: user.id });
      await recordHistory(tx, { changeId: id, userId: user.id, action: "PIR", correlationId, comment: dto.result });
    });
    return { data: { id } };
  }

  private async load(tx: Prisma.TransactionClient, id: string) {
    const change = await tx.changeRequest.findUnique({ where: { id }, include: { approvals: true } });
    if (!change) throw new NotFoundException("Change not found");
    return change;
  }

  private assertVersion(current: number, expected: number) {
    if (current !== expected) throw new ConflictException("This change was updated by someone else. Reload and try again.");
  }

  private requireFields(change: { shortDescription: string; description: string; type: ChangeType; emergencyJustification: string | null; backoutPlan: string | null; riskLevel: RiskLevel | null }) {
    if (!change.shortDescription || !change.description) throw new BadRequestException("Description is required before submit");
    if (change.type === ChangeType.EMERGENCY && !change.emergencyJustification) throw new BadRequestException("Emergency changes require a justification");
    if (change.type === ChangeType.EMERGENCY && !change.backoutPlan) throw new BadRequestException("Emergency changes require a backout plan");
    if (!change.riskLevel && change.type !== ChangeType.STANDARD) throw new BadRequestException("Complete the risk assessment before submit");
  }

  private async move(tx: Prisma.TransactionClient, change: { id: string; state: ChangeState; version: number }, to: ChangeState, user: AuthenticatedUser, correlationId?: string, system = false, bumpVersion = true) {
    if (change.state === to) return;
    if (!system) {
      const rule = await tx.changeStateRule.findFirst({ where: { fromState: change.state, toState: to, isActive: true } });
      if (!rule) throw new BadRequestException(`Cannot move from ${change.state} to ${to}`);
    }
    await tx.changeRequest.update({ where: { id: change.id }, data: { state: to, ...(bumpVersion ? { version: { increment: 1 } } : {}), updatedById: user.id, approvalStatus: to === ChangeState.PENDING_APPROVAL ? ChangeApprovalStatus.PENDING : to === ChangeState.APPROVED ? ChangeApprovalStatus.APPROVED : undefined } });
    await recordHistory(tx, { changeId: change.id, userId: user.id, action: "STATE", correlationId, entries: [{ field: "state", oldValue: change.state, newValue: to }] });
  }

  private async instantiateApprovals(tx: Prisma.TransactionClient, change: { id: string; type: ChangeType; riskLevel: RiskLevel | null; approvals: { id: string }[] }, user: AuthenticatedUser) {
    if (change.approvals.length) return;
    const policies = await tx.approvalPolicy.findMany({ where: { changeType: change.type, isActive: true }, include: { steps: { orderBy: { sequence: "asc" } } } });
    const rank = RANK[change.riskLevel ?? "MEDIUM"] ?? 3;
    const matches = policies.filter((policy) => rank >= (policy.minRisk ? RANK[policy.minRisk] : 0) && rank <= (policy.maxRisk ? RANK[policy.maxRisk] : 99));
    matches.sort((a, b) => (b.minRisk ? RANK[b.minRisk] : 0) - (a.minRisk ? RANK[a.minRisk] : 0));
    const policy = matches[0];
    if (!policy) return;
    const approvers = new Map<RoleName, string>();
    for (const step of policy.steps) {
      const candidates = await userIdsByRoles(tx, [step.requiredRole]);
      const approverId = candidates.find((candidate) => candidate !== user.id) ?? candidates[0];
      if (approverId) approvers.set(step.requiredRole, approverId);
      await tx.changeApproval.create({
        data: {
          changeId: change.id,
          approvalType: step.approvalType,
          sequence: step.sequence,
          requiredRole: step.requiredRole,
          approverId: approverId ?? null,
          dueAt: step.deadlineHours ? new Date(Date.now() + step.deadlineHours * 3600_000) : null,
        },
      });
      if (approverId) await notifyUsers(tx, [approverId], { title: "Approval requested", message: "A change is waiting for your decision", entityId: change.id });
    }
  }

  private async assertCanDecide(
    tx: Prisma.TransactionClient,
    change: { id: string; type: ChangeType; requestedById: string; approvals: { id: string; sequence: number; status: ApprovalDecisionStatus; requiredRole: RoleName; approverId: string | null; delegatedToId: string | null }[] },
    approval: { id: string; sequence: number; requiredRole: RoleName; approverId: string | null; delegatedToId: string | null },
    user: AuthenticatedUser,
    dto: DecisionDto,
  ) {
    const policy = await tx.changeTypePolicy.findUnique({ where: { changeType: change.type } });
    const approvalPolicy = await tx.approvalPolicy.findFirst({ where: { changeType: change.type, isActive: true } });
    const self = user.id === change.requestedById;
    if (self && dto.decision !== "DELEGATED" && !(policy?.allowSelfApproval && approvalPolicy?.allowSelfApproval)) {
      throw new ForbiddenException("You cannot approve your own change.");
    }
    const delegated = approval.delegatedToId === user.id;
    const assigned = approval.approverId === user.id;
    const roleMatch = !approval.approverId && hasRole(user, [approval.requiredRole, RoleName.ITSM_ADMINISTRATOR]);
    if (!delegated && !assigned && !roleMatch && !hasRole(user, [RoleName.ITSM_ADMINISTRATOR])) {
      throw new ForbiddenException("You are not an approver for this step.");
    }
    const mode = approvalPolicy?.mode ?? ApprovalMode.SEQUENTIAL;
    if (mode === ApprovalMode.SEQUENTIAL) {
      const earlierOpen = change.approvals.some((row) => row.sequence < approval.sequence && (row.status === ApprovalDecisionStatus.PENDING || row.status === ApprovalDecisionStatus.MORE_INFO));
      if (earlierOpen) throw new BadRequestException("Earlier approval steps are still open");
    }
  }

  private async guard(
    tx: Prisma.TransactionClient,
    change: {
      id: string;
      state: ChangeState;
      type: ChangeType;
      plannedStart: Date | null;
      plannedEnd: Date | null;
      configurationItemId: string | null;
      businessServiceId: string | null;
      implementationOutcome: ImplementationOutcome | null;
      pirRequired: boolean;
      rollbackExecuted: boolean;
      backoutRequired: boolean;
      approvals: { status: ApprovalDecisionStatus }[];
    },
    guard: string,
    dto: StateDto,
    user: AuthenticatedUser,
  ) {
    if (guard === "NONE") return;
    if (guard === "APPROVALS_COMPLETE") {
      const pending = change.approvals.some((row) => row.status === ApprovalDecisionStatus.PENDING || row.status === ApprovalDecisionStatus.MORE_INFO);
      if (!change.approvals.length || pending) throw new BadRequestException("Required approvals are not complete");
    }
    if (guard === "HAS_REJECTION") {
      if (!change.approvals.some((row) => row.status === ApprovalDecisionStatus.REJECTED)) throw new BadRequestException("A rejection is required");
    }
    if (guard === "HAS_WINDOW" || guard === "IMPLEMENT_WINDOW") {
      const setting = await tx.appSetting.findUnique({ where: { key: "change.scheduleOverrideRoles" } });
      const roles = (setting?.value ?? "ITSM_ADMINISTRATOR|CHANGE_MANAGER").split("|");
      const result = await assertCanSchedule(tx, change, { justification: dto.justification, authorized: hasRole(user, roles) });
      if (result.conflicts.length) {
        await tx.changeRequest.update({
          where: { id: change.id },
          data: { scheduleOverrideJustification: dto.justification, scheduleOverrideById: user.id, scheduleOverrideAt: new Date() },
        });
        await recordHistory(tx, { changeId: change.id, userId: user.id, action: "SCHEDULE_OVERRIDE", comment: dto.justification });
      }
      if (guard === "IMPLEMENT_WINDOW" && change.plannedStart && change.plannedStart.getTime() > Date.now()) {
        const typePolicy = await tx.changeTypePolicy.findUnique({ where: { changeType: change.type } });
        const early = (typePolicy?.earlyImplementRoles ?? "").split("|");
        if (!dto.justification || !hasRole(user, early)) throw new ForbiddenException("Implementation before the window requires an authorized override.");
        await recordHistory(tx, { changeId: change.id, userId: user.id, action: "EARLY_IMPLEMENT", comment: dto.justification });
      }
    }
    if (guard === "OUTCOME_SUCCESS") {
      const outcome = dto.implementationOutcome ?? change.implementationOutcome;
      if (outcome !== ImplementationOutcome.SUCCESS && outcome !== ImplementationOutcome.PARTIAL) throw new BadRequestException("Record a successful implementation outcome first");
    }
    if (guard === "OUTCOME_FAILURE") {
      const outcome = dto.implementationOutcome ?? change.implementationOutcome;
      if (outcome !== ImplementationOutcome.FAILURE) throw new BadRequestException("Record a failed implementation outcome first");
    }
    if (guard === "ROLLBACK_IF_REQUIRED" && change.backoutRequired && !change.rollbackExecuted && !dto.rollbackExecuted) {
      throw new BadRequestException("Record the rollback before review");
    }
    if (guard === "CLOSE_READY") {
      if (!change.implementationOutcome) throw new BadRequestException("An implementation outcome is required before close");
      if (change.pirRequired) {
        const pir = await tx.changePir.findUnique({ where: { changeId: change.id } });
        if (!pir?.result) throw new BadRequestException("A completed PIR is required before close");
      }
    }
  }

  private async notifyState(tx: Prisma.TransactionClient, change: { id: string; number: string; requestedById: string; changeOwnerId: string | null; implementationLeadId: string | null }, to: ChangeState) {
    const ids = [change.requestedById, change.changeOwnerId, change.implementationLeadId];
    const titles: Partial<Record<ChangeState, string>> = {
      SCHEDULED: "Change scheduled",
      IMPLEMENTING: "Implementation started",
      IMPLEMENTED: "Change completed",
      FAILED: "Change failed",
      PENDING_REVIEW: "PIR pending",
      CLOSED: "Change closed",
      REJECTED: "Change rejected",
    };
    const title = titles[to];
    if (title) await notifyUsers(tx, ids, { title, message: `${change.number}: ${title}`, entityId: change.id });
  }

  private assertTest(status: TestStatus, actual?: string) {
    if ((status === TestStatus.PASSED || status === TestStatus.FAILED || status === TestStatus.BLOCKED) && !actual?.trim()) {
      throw new BadRequestException("Actual results are required for this test status");
    }
  }
}

const EDITOR_PLUS_APPROVERS: RoleName[] = [
  RoleName.ITSM_ADMINISTRATOR,
  RoleName.CHANGE_MANAGER,
  RoleName.CHANGE_REQUESTER,
  RoleName.CHANGE_OWNER,
  RoleName.IMPLEMENTATION_LEAD,
  RoleName.TECHNICAL_APPROVER,
  RoleName.BUSINESS_APPROVER,
  RoleName.CAB_MEMBER,
];
