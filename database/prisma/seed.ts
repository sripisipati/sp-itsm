import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ApprovalMode,
  ApprovalType,
  CabDecisionType,
  ChangeState,
  ChangeType,
  Impact,
  ImpactLevel,
  ImplementationOutcome,
  HistoryActionType,
  IncidentStatus,
  NoteType,
  Severity,
  PirResult,
  PrismaClient,
  Priority,
  Probability,
  ProblemState,
  RiskLevel,
  RoleName,
  TaskStatus,
  TestStatus,
  Urgency,
} from "../../backend/src/generated/prisma/client";

for (const candidate of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../.env")]) {
  if (existsSync(candidate)) {
    loadEnv({ path: candidate });
    break;
  }
}

const databaseUrl = process.env.DATABASE_URL ?? "";
const databaseName = new URL(databaseUrl.replace("postgresql://", "http://")).pathname.replace("/", "");
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed because NODE_ENV=production");
  process.exit(1);
}
if (databaseName !== "itsm" && databaseName !== "itsm_test") {
  console.error(`Refusing to seed database "${databaseName}". Only itsm and itsm_test are allowed.`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const PASSWORD = "ChangeMe!Dev1";

const USERS: Array<{ email: string; employeeId: string; firstName: string; lastName: string; roles: RoleName[] }> = [
  { email: "admin@itsm.local", employeeId: "EMP1001", firstName: "Avery", lastName: "Admin", roles: [RoleName.ITSM_ADMINISTRATOR] },
  { email: "change.manager@itsm.local", employeeId: "EMP1002", firstName: "Morgan", lastName: "Chen", roles: [RoleName.CHANGE_MANAGER] },
  { email: "requester@itsm.local", employeeId: "EMP1003", firstName: "Riley", lastName: "Nguyen", roles: [RoleName.CHANGE_REQUESTER, RoleName.REQUESTER] },
  { email: "owner@itsm.local", employeeId: "EMP1004", firstName: "Jordan", lastName: "Patel", roles: [RoleName.CHANGE_OWNER] },
  { email: "tech.approver@itsm.local", employeeId: "EMP1005", firstName: "Sam", lastName: "Okoye", roles: [RoleName.TECHNICAL_APPROVER] },
  { email: "biz.approver@itsm.local", employeeId: "EMP1006", firstName: "Casey", lastName: "Brooks", roles: [RoleName.BUSINESS_APPROVER] },
  { email: "cab.member@itsm.local", employeeId: "EMP1007", firstName: "Quinn", lastName: "Adler", roles: [RoleName.CAB_MEMBER] },
  { email: "implementer@itsm.local", employeeId: "EMP1008", firstName: "Alex", lastName: "Rivera", roles: [RoleName.IMPLEMENTATION_LEAD] },
  { email: "auditor@itsm.local", employeeId: "EMP1009", firstName: "Taylor", lastName: "Singh", roles: [RoleName.CHANGE_AUDITOR] },
  { email: "readonly@itsm.local", employeeId: "EMP1010", firstName: "Jamie", lastName: "Cole", roles: [RoleName.READ_ONLY] },
  { email: "incident.manager@itsm.local", employeeId: "EMP1011", firstName: "Drew", lastName: "Walsh", roles: [RoleName.INCIDENT_MANAGER] },
  { email: "agent@itsm.local", employeeId: "EMP1012", firstName: "Noah", lastName: "Kim", roles: [RoleName.SUPPORT_AGENT] },
  { email: "manager@itsm.local", employeeId: "EMP1101", firstName: "Morgan", lastName: "Hale", roles: [RoleName.INCIDENT_MANAGER] },
  { email: "agent.network@itsm.local", employeeId: "EMP1102", firstName: "Samir", lastName: "Patel", roles: [RoleName.SUPPORT_AGENT] },
  { email: "agent.apps@itsm.local", employeeId: "EMP1103", firstName: "Priya", lastName: "Shah", roles: [RoleName.SUPPORT_AGENT] },
  { email: "agent.desk@itsm.local", employeeId: "EMP1104", firstName: "Luis", lastName: "Ortega", roles: [RoleName.SUPPORT_AGENT] },
  { email: "agent.infra@itsm.local", employeeId: "EMP1105", firstName: "Elena", lastName: "Rossi", roles: [RoleName.SUPPORT_AGENT] },
  { email: "requester.finance@itsm.local", employeeId: "EMP1106", firstName: "Jordan", lastName: "Blake", roles: [RoleName.REQUESTER] },
  { email: "requester.hr@itsm.local", employeeId: "EMP1107", firstName: "Casey", lastName: "Nguyen", roles: [RoleName.REQUESTER] },
  { email: "requester.sales@itsm.local", employeeId: "EMP1108", firstName: "Avery", lastName: "Brooks", roles: [RoleName.REQUESTER] },
];

function day(offset: number, hour = 10): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const roleIds = new Map<RoleName, string>();
  for (const name of Object.values(RoleName)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description: name.replaceAll("_", " ") },
      create: { name, description: name.replaceAll("_", " ") },
    });
    roleIds.set(name, role.id);
  }

  const userIds = new Map<string, string>();
  for (const account of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    let employeeId = account.employeeId;
    if (!existing) {
      const taken = await prisma.user.findUnique({ where: { employeeId } });
      if (taken) employeeId = `C${account.employeeId}`;
    }
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, isActive: true, firstName: account.firstName, lastName: account.lastName },
        })
      : await prisma.user.create({
          data: { email: account.email, passwordHash, firstName: account.firstName, lastName: account.lastName, employeeId },
        });
    userIds.set(account.email, user.id);
  }
  await prisma.user.updateMany({ data: { passwordHash } });
  for (const account of USERS) {
    const userId = userIds.get(account.email)!;
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.userRole.createMany({ data: account.roles.map((role) => ({ userId, roleId: roleIds.get(role)! })) });
  }
  const id = (email: string) => {
    const value = userIds.get(email);
    if (!value) throw new Error(`Seed user ${email} was not loaded`);
    return value;
  };
  for (const email of ["requester.finance@itsm.local", "requester.hr@itsm.local", "requester.sales@itsm.local", "manager@itsm.local", "agent.desk@itsm.local", "agent.network@itsm.local", "agent.apps@itsm.local", "agent.infra@itsm.local"]) {
    if (!userIds.has(email)) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) userIds.set(email, existing.id);
    }
  }

  await prisma.cabDecision.deleteMany();
  await prisma.cabAgendaItem.deleteMany();
  await prisma.cabMeetingMember.deleteMany();
  await prisma.cabMeeting.deleteMany();
  await prisma.pirAction.deleteMany();
  await prisma.changePir.deleteMany();
  await prisma.changeAttachment.deleteMany();
  await prisma.changeNote.deleteMany();
  await prisma.changeHistory.deleteMany();
  await prisma.changeApproval.deleteMany();
  await prisma.changeTestCase.deleteMany();
  await prisma.changeTaskDependency.deleteMany();
  await prisma.changeTask.deleteMany();
  await prisma.changeAffectedCi.deleteMany();
  await prisma.changeAffectedService.deleteMany();
  await prisma.changeRequest.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.incidentHistory.deleteMany();
  await prisma.incidentNote.deleteMany();
  await prisma.incidentAttachment.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.maintenanceWindow.deleteMany();
  await prisma.blackoutPeriod.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.assignmentGroup.deleteMany();
  const groupNames = ["Network", "Service Desk", "Application Support", "Infrastructure", "Database", "Security", "Change Advisory"];
  const groups = new Map<string, string>();
  for (const name of groupNames) {
    const group = await prisma.assignmentGroup.create({ data: { name, description: `${name} assignment group` } });
    groups.set(name, group.id);
  }
  await prisma.groupMember.createMany({
    data: [
      { groupId: groups.get("Change Advisory")!, userId: id("change.manager@itsm.local") },
      { groupId: groups.get("Infrastructure")!, userId: id("implementer@itsm.local") },
      { groupId: groups.get("Service Desk")!, userId: id("agent@itsm.local") },
      { groupId: groups.get("Service Desk")!, userId: id("agent.desk@itsm.local") },
      { groupId: groups.get("Network")!, userId: id("agent.network@itsm.local") },
      { groupId: groups.get("Network")!, userId: id("agent.infra@itsm.local") },
      { groupId: groups.get("Application Support")!, userId: id("agent.apps@itsm.local") },
      { groupId: groups.get("Infrastructure")!, userId: id("agent.infra@itsm.local") },
      { groupId: groups.get("Application Support")!, userId: id("owner@itsm.local") },
      { groupId: groups.get("Security")!, userId: id("tech.approver@itsm.local") },
    ],
  });

  await prisma.configurationItem.deleteMany();
  await prisma.businessService.deleteMany();
  const ciNames = ["prod-web-01", "prod-web-02", "payments-api", "edge-firewall", "directory-01", "mail-gateway", "warehouse-db", "vpn-concentrator"];
  const cis = new Map<string, string>();
  for (const name of ciNames) {
    const ci = await prisma.configurationItem.create({ data: { name, ciType: name.includes("db") ? "Database" : "Server", description: `${name} configuration item` } });
    cis.set(name, ci.id);
  }
  const serviceNames = ["Customer Portal", "Payments", "Email", "Identity", "Warehouse", "VPN"];
  const services = new Map<string, string>();
  for (const name of serviceNames) {
    const service = await prisma.businessService.create({ data: { name, description: `${name} business service` } });
    services.set(name, service.id);
  }

  await prisma.incidentCategory.deleteMany();
  const software = await prisma.incidentCategory.create({ data: { name: "Software" } });
  await prisma.incidentCategory.create({ data: { name: "Application", parentId: software.id } });
  await prisma.priorityMatrix.deleteMany();
  const matrix: Array<[Impact, Urgency, Priority]> = [
    [Impact.HIGH, Urgency.HIGH, Priority.P1],
    [Impact.HIGH, Urgency.MEDIUM, Priority.P2],
    [Impact.HIGH, Urgency.LOW, Priority.P3],
    [Impact.MEDIUM, Urgency.HIGH, Priority.P2],
    [Impact.MEDIUM, Urgency.MEDIUM, Priority.P3],
    [Impact.MEDIUM, Urgency.LOW, Priority.P4],
    [Impact.LOW, Urgency.HIGH, Priority.P3],
    [Impact.LOW, Urgency.MEDIUM, Priority.P4],
    [Impact.LOW, Urgency.LOW, Priority.P4],
  ];
  await prisma.priorityMatrix.createMany({ data: matrix.map(([impact, urgency, calculatedPriority]) => ({ impact, urgency, calculatedPriority })) });
  await prisma.statusTransition.deleteMany();
  const transitions: Array<[IncidentStatus, IncidentStatus]> = [
    [IncidentStatus.NEW, IncidentStatus.ASSIGNED],
    [IncidentStatus.NEW, IncidentStatus.IN_PROGRESS],
    [IncidentStatus.NEW, IncidentStatus.CANCELLED],
    [IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS],
    [IncidentStatus.ASSIGNED, IncidentStatus.ON_HOLD],
    [IncidentStatus.ASSIGNED, IncidentStatus.CANCELLED],
    [IncidentStatus.IN_PROGRESS, IncidentStatus.ON_HOLD],
    [IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED],
    [IncidentStatus.IN_PROGRESS, IncidentStatus.CANCELLED],
    [IncidentStatus.ON_HOLD, IncidentStatus.ASSIGNED],
    [IncidentStatus.ON_HOLD, IncidentStatus.IN_PROGRESS],
    [IncidentStatus.ON_HOLD, IncidentStatus.CANCELLED],
    [IncidentStatus.RESOLVED, IncidentStatus.CLOSED],
    [IncidentStatus.RESOLVED, IncidentStatus.IN_PROGRESS],
  ];
  await prisma.statusTransition.createMany({ data: transitions.map(([fromStatus, toStatus]) => ({ fromStatus, toStatus })) });
  await prisma.resolutionCode.deleteMany();
  await prisma.resolutionCode.createMany({
    data: [
      { code: "SOLVED_PERMANENTLY", label: "Solved permanently" },
      { code: "WORKAROUND", label: "Workaround provided" },
    ],
  });

  await prisma.appSetting.deleteMany();
  await prisma.appSetting.createMany({
    data: [
      { key: "ticket.prefix", value: "INC" },
      { key: "ticket.padLength", value: "7" },
      { key: "change.prefix", value: "CHG" },
      { key: "change.scheduleOverrideRoles", value: "ITSM_ADMINISTRATOR|CHANGE_MANAGER" },
      { key: "ui.timeZone", value: "UTC" },
      { key: "ui.brandName", value: "ITSM" },
    ],
  });
  for (const prefix of ["INC", "CHG", "CTASK", "CAB", "PRB"]) {
    await prisma.ticketSequence.upsert({ where: { prefix }, update: { nextNumber: 1000 }, create: { prefix, nextNumber: 1000 } });
  }

  await prisma.changeTemplate.deleteMany();
  await prisma.changeCategory.deleteMany();
  const changeCat = await prisma.changeCategory.create({ data: { name: "Infrastructure" } });
  const changeSub = await prisma.changeCategory.create({ data: { name: "Server", parentId: changeCat.id } });
  await prisma.changeCategory.create({ data: { name: "Application" } });
  await prisma.changeTemplate.create({
    data: { name: "Standard server patch", description: "Monthly OS patch using the standard template.", categoryId: changeCat.id, implementationPlan: "Apply the approved patch set and reboot.", backoutPlan: "Restore the previous image." },
  });

  await prisma.riskFactorScore.deleteMany();
  await prisma.riskUserBand.deleteMany();
  await prisma.riskLevelRank.deleteMany();
  await prisma.riskEngineConfig.upsert({
    where: { id: "default" },
    update: { impactWeight: 0.4, probabilityWeight: 0.3, downtimeWeight: 0.15, userImpactWeight: 0.15, veryHighMin: 3.2, highMin: 2.4, mediumMin: 1.6, lowMin: 0.8 },
    create: { id: "default", impactWeight: 0.4, probabilityWeight: 0.3, downtimeWeight: 0.15, userImpactWeight: 0.15, veryHighMin: 3.2, highMin: 2.4, mediumMin: 1.6, lowMin: 0.8 },
  });
  const impacts: Array<[string, number]> = [["VERY_HIGH", 5], ["HIGH", 4], ["MEDIUM", 3], ["LOW", 2], ["VERY_LOW", 1]];
  await prisma.riskFactorScore.createMany({
    data: [
      ...impacts.map(([factorValue, score]) => ({ factorType: "IMPACT", factorValue, score })),
      { factorType: "PROBABILITY", factorValue: "HIGH", score: 5 },
      { factorType: "PROBABILITY", factorValue: "MEDIUM", score: 3 },
      { factorType: "PROBABILITY", factorValue: "LOW", score: 1 },
      { factorType: "DOWNTIME", factorValue: "true", score: 4 },
      { factorType: "DOWNTIME", factorValue: "false", score: 1 },
    ],
  });
  await prisma.riskUserBand.createMany({
    data: [
      { minUsers: 0, maxUsers: 10, score: 1 },
      { minUsers: 11, maxUsers: 100, score: 3 },
      { minUsers: 101, maxUsers: null, score: 5 },
    ],
  });
  await prisma.riskLevelRank.createMany({
    data: [
      { level: RiskLevel.VERY_HIGH, rank: 5 },
      { level: RiskLevel.HIGH, rank: 4 },
      { level: RiskLevel.MEDIUM, rank: 3 },
      { level: RiskLevel.LOW, rank: 2 },
      { level: RiskLevel.VERY_LOW, rank: 1 },
    ],
  });
  await prisma.changePriorityMatrix.deleteMany();
  const priorities: ImpactLevel[] = [ImpactLevel.VERY_HIGH, ImpactLevel.HIGH, ImpactLevel.MEDIUM, ImpactLevel.LOW, ImpactLevel.VERY_LOW];
  const urgencies = [Urgency.HIGH, Urgency.MEDIUM, Urgency.LOW];
  await prisma.changePriorityMatrix.createMany({
    data: priorities.flatMap((impact) =>
      urgencies.map((urgency) => ({
        impact,
        urgency,
        priority: impact === ImpactLevel.VERY_HIGH && urgency === Urgency.HIGH ? "CRITICAL" : impact === ImpactLevel.VERY_LOW ? "PLANNING" : impact === ImpactLevel.LOW ? "LOW" : impact === ImpactLevel.MEDIUM ? "MODERATE" : "HIGH",
      })),
    ),
  });

  await prisma.approvalPolicyStep.deleteMany();
  await prisma.approvalPolicy.deleteMany();
  const standard = await prisma.approvalPolicy.create({ data: { name: "Standard technical", changeType: ChangeType.STANDARD, mode: ApprovalMode.SEQUENTIAL, maxRisk: RiskLevel.MEDIUM } });
  await prisma.approvalPolicyStep.create({ data: { policyId: standard.id, sequence: 1, approvalType: ApprovalType.TECHNICAL, requiredRole: RoleName.TECHNICAL_APPROVER, deadlineHours: 48 } });
  const normalLow = await prisma.approvalPolicy.create({ data: { name: "Normal moderate", changeType: ChangeType.NORMAL, mode: ApprovalMode.PARALLEL, maxRisk: RiskLevel.MEDIUM } });
  await prisma.approvalPolicyStep.createMany({
    data: [
      { policyId: normalLow.id, sequence: 1, approvalType: ApprovalType.TECHNICAL, requiredRole: RoleName.TECHNICAL_APPROVER, deadlineHours: 72 },
      { policyId: normalLow.id, sequence: 1, approvalType: ApprovalType.BUSINESS, requiredRole: RoleName.BUSINESS_APPROVER, deadlineHours: 72 },
    ],
  });
  const normalHigh = await prisma.approvalPolicy.create({ data: { name: "Normal high", changeType: ChangeType.NORMAL, mode: ApprovalMode.SEQUENTIAL, minRisk: RiskLevel.HIGH } });
  await prisma.approvalPolicyStep.createMany({
    data: [
      { policyId: normalHigh.id, sequence: 1, approvalType: ApprovalType.TECHNICAL, requiredRole: RoleName.TECHNICAL_APPROVER, deadlineHours: 48 },
      { policyId: normalHigh.id, sequence: 2, approvalType: ApprovalType.BUSINESS, requiredRole: RoleName.BUSINESS_APPROVER, deadlineHours: 48 },
      { policyId: normalHigh.id, sequence: 3, approvalType: ApprovalType.CAB, requiredRole: RoleName.CAB_MEMBER, deadlineHours: 72 },
    ],
  });
  const emergency = await prisma.approvalPolicy.create({ data: { name: "Emergency", changeType: ChangeType.EMERGENCY, mode: ApprovalMode.PARALLEL } });
  await prisma.approvalPolicyStep.createMany({
    data: [
      { policyId: emergency.id, sequence: 1, approvalType: ApprovalType.EMERGENCY, requiredRole: RoleName.TECHNICAL_APPROVER, deadlineHours: 4 },
      { policyId: emergency.id, sequence: 1, approvalType: ApprovalType.CAB, requiredRole: RoleName.CAB_MEMBER, deadlineHours: 4 },
    ],
  });

  await prisma.changeStateRule.deleteMany();
  const manager = "ITSM_ADMINISTRATOR|CHANGE_MANAGER";
  const editors = `${manager}|CHANGE_OWNER|CHANGE_REQUESTER|IMPLEMENTATION_LEAD`;
  const rules: Array<[ChangeState, ChangeState, string, string]> = [
    [ChangeState.DRAFT, ChangeState.SUBMITTED, "NONE", editors],
    [ChangeState.DRAFT, ChangeState.CANCELLED, "NONE", editors],
    [ChangeState.SUBMITTED, ChangeState.ASSESSMENT, "NONE", manager + "|CHANGE_OWNER"],
    [ChangeState.SUBMITTED, ChangeState.CANCELLED, "NONE", editors],
    [ChangeState.ASSESSMENT, ChangeState.PENDING_APPROVAL, "NONE", manager + "|CHANGE_OWNER"],
    [ChangeState.PENDING_APPROVAL, ChangeState.APPROVED, "APPROVALS_COMPLETE", manager],
    [ChangeState.PENDING_APPROVAL, ChangeState.REJECTED, "HAS_REJECTION", manager],
    [ChangeState.APPROVED, ChangeState.SCHEDULED, "HAS_WINDOW", manager],
    [ChangeState.APPROVED, ChangeState.DEFERRED, "NONE", manager],
    [ChangeState.SCHEDULED, ChangeState.IMPLEMENTING, "IMPLEMENT_WINDOW", manager + "|IMPLEMENTATION_LEAD"],
    [ChangeState.IMPLEMENTING, ChangeState.IMPLEMENTED, "OUTCOME_SUCCESS", manager + "|IMPLEMENTATION_LEAD"],
    [ChangeState.IMPLEMENTING, ChangeState.FAILED, "OUTCOME_FAILURE", manager + "|IMPLEMENTATION_LEAD"],
    [ChangeState.FAILED, ChangeState.PENDING_REVIEW, "ROLLBACK_IF_REQUIRED", manager + "|IMPLEMENTATION_LEAD"],
    [ChangeState.IMPLEMENTED, ChangeState.PENDING_REVIEW, "NONE", manager + "|CHANGE_OWNER"],
    [ChangeState.PENDING_REVIEW, ChangeState.CLOSED, "CLOSE_READY", manager],
    [ChangeState.DEFERRED, ChangeState.APPROVED, "NONE", manager],
  ];
  await prisma.changeStateRule.createMany({ data: rules.map(([fromState, toState, guard, allowedRoles]) => ({ fromState, toState, guard, allowedRoles })) });

  await prisma.rollbackRequirement.deleteMany();
  const rollbackRows = [];
  for (const changeType of Object.values(ChangeType)) {
    for (const risk of Object.values(RiskLevel)) {
      const required = changeType === ChangeType.EMERGENCY || risk === RiskLevel.HIGH || risk === RiskLevel.VERY_HIGH;
      rollbackRows.push({ changeType, risk, required });
    }
  }
  await prisma.rollbackRequirement.createMany({ data: rollbackRows });
  for (const changeType of Object.values(ChangeType)) {
    await prisma.changeTypePolicy.upsert({
      where: { changeType },
      update: {},
      create: {
        changeType,
        requiresAssessment: changeType === ChangeType.NORMAL,
        pirRequired: changeType === ChangeType.EMERGENCY,
        pirMinRisk: changeType === ChangeType.NORMAL ? RiskLevel.HIGH : null,
        allowSelfApproval: false,
      },
    });
  }

  async function nextNumber(prefix: string) {
    const row = await prisma.ticketSequence.update({ where: { prefix }, data: { nextNumber: { increment: 1 } } });
    return `${prefix}${String(row.nextNumber).padStart(7, "0")}`;
  }

  const incidentSummaries = [
    "Payroll VPN tunnel drops for the finance floor",
    "Outlook cannot send messages with large attachments",
    "Laptop fails to boot after the overnight update",
    "Shared printer on floor 3 jams every other job",
    "SAP production transactions time out after 30 seconds",
    "New hire cannot sign in on the first morning",
    "Corporate Wi-Fi captive portal loops endlessly",
    "CRM search returns no open opportunities",
    "Password reset email never arrives",
    "Conference room display stays black",
    "Home drive mapping fails with access denied",
    "Legitimate vendor invoices are quarantined",
    "VPN split tunnel excludes the payroll application",
    "Laptop battery drains fully within an hour",
    "Teams drops audio for external guests",
    "Print queue is stuck on a held job",
    "Account locks after repeated MFA prompts",
    "ERP report exports a blank spreadsheet",
    "Guest Wi-Fi stops issuing DHCP addresses",
    "Dock does not detect the keyboard after resume",
    "Billing shared mailbox is missing",
    "Application portal shows a certificate warning",
    "Approved VPN client will not install",
    "External monitor flickers through the dock",
    "Sales dashboard takes several minutes to load",
    "Finance share access request for a new analyst",
    "Corporate email signature is not applying",
    "Checkout service returns HTTP 504 to payments",
    "HR identity sync is two days behind",
    "Chicago network closet switch is unreachable",
    "CAD viewer causes a laptop blue screen",
    "Replaced the failed disk in the print server",
  ];
  const incidentStatuses: IncidentStatus[] = [
    IncidentStatus.IN_PROGRESS, IncidentStatus.NEW, IncidentStatus.ASSIGNED, IncidentStatus.RESOLVED,
    IncidentStatus.ON_HOLD, IncidentStatus.IN_PROGRESS, IncidentStatus.CLOSED, IncidentStatus.NEW,
    IncidentStatus.ASSIGNED, IncidentStatus.CANCELLED, IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED,
    IncidentStatus.NEW, IncidentStatus.ASSIGNED, IncidentStatus.ON_HOLD, IncidentStatus.IN_PROGRESS,
    IncidentStatus.RESOLVED, IncidentStatus.CLOSED, IncidentStatus.NEW, IncidentStatus.ASSIGNED,
    IncidentStatus.IN_PROGRESS, IncidentStatus.ON_HOLD, IncidentStatus.RESOLVED, IncidentStatus.NEW,
    IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS, IncidentStatus.CLOSED, IncidentStatus.CANCELLED,
    IncidentStatus.RESOLVED, IncidentStatus.NEW, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS,
  ];
  const requesters = ["requester.finance@itsm.local", "requester.hr@itsm.local", "requester.sales@itsm.local"];
  const incidents = [];
  for (let index = 0; index < incidentSummaries.length; index += 1) {
    const status = incidentStatuses[index];
    const impact = index === 0 ? Impact.HIGH : Impact.MEDIUM;
    const urgency = index === 0 ? Urgency.HIGH : Urgency.MEDIUM;
    const unassigned = status === IncidentStatus.NEW;
    const callerEmail = requesters[index % requesters.length];
    const assigneeEmail = unassigned ? null : "agent@itsm.local";
    const resolved = status === IncidentStatus.RESOLVED || status === IncidentStatus.CLOSED;
    const incident = await prisma.incident.create({
      data: {
        ticketNumber: await nextNumber("INC"),
        shortDescription: incidentSummaries[index],
        description: `${incidentSummaries[index]}. Users reported the issue during business hours and need service restored without losing in-progress work.`,
        impact,
        urgency,
        severity: index === 0 ? Severity.CRITICAL : Severity.MEDIUM,
        priority: index === 0 ? Priority.P1 : Priority.P3,
        status,
        callerId: id(callerEmail),
        contactInformation: callerEmail,
        configurationItemId: cis.get(ciNames[index % ciNames.length]),
        businessServiceId: services.get(serviceNames[index % serviceNames.length]),
        assignmentGroupId: unassigned ? null : groups.get("Service Desk"),
        assignedToId: assigneeEmail ? id(assigneeEmail) : null,
        assignedOn: assigneeEmail ? day(-((index % 12) + 1), 9) : null,
        resolutionCode: resolved ? "SOLVED_PERMANENTLY" : null,
        resolutionNotes: resolved ? "Service was restored and the reporter confirmed normal operation." : null,
        resolvedById: resolved ? id("agent@itsm.local") : null,
        resolvedOn: resolved ? day(-1, 16) : null,
        affectedLocation: "Headquarters",
        impactedUsers: 5 + index,
        createdById: id("agent@itsm.local"),
        updatedById: id("agent@itsm.local"),
        createdAt: day(-((index % 20) + 1), 8),
      },
    });
    if (index % 3 === 0) {
      await prisma.incidentNote.create({
        data: {
          incidentId: incident.id,
          noteType: NoteType.WORK_NOTE,
          content: "Checked monitoring and recent changes. Internal investigation is underway.",
          createdById: id("agent@itsm.local"),
        },
      });
      await prisma.incidentNote.create({
        data: {
          incidentId: incident.id,
          noteType: NoteType.ADDITIONAL_COMMENT,
          content: "We are investigating and will update you when service is stable.",
          createdById: id("agent@itsm.local"),
        },
      });
    }
    await prisma.incidentHistory.create({
      data: {
        incidentId: incident.id,
        fieldName: "status",
        oldValue: null,
        newValue: IncidentStatus.NEW,
        actionType: HistoryActionType.CREATED,
        changedById: id("agent@itsm.local"),
        changedAt: incident.createdAt,
      },
    });
    incidents.push(incident);
  }
  const problems = [];
  for (let index = 0; index < 4; index += 1) {
    problems.push(
      await prisma.problem.create({
        data: {
          number: await nextNumber("PRB"),
          shortDescription: ["Recurring login failures", "Payment latency", "Certificate expiry", "Database lock contention"][index],
          state: index === 3 ? ProblemState.RESOLVED : ProblemState.NEW,
        },
      }),
    );
  }

  const specs: Array<{ type: ChangeType; state: ChangeState; risk: RiskLevel; group: string; ci: string; service: string }> = [];
  const typeCycle = [ChangeType.NORMAL, ChangeType.STANDARD, ChangeType.EMERGENCY, ChangeType.NORMAL];
  const riskCycle = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH, RiskLevel.VERY_LOW];
  const stateCycle: ChangeState[] = [
    ChangeState.DRAFT, ChangeState.SUBMITTED, ChangeState.ASSESSMENT, ChangeState.PENDING_APPROVAL, ChangeState.APPROVED,
    ChangeState.SCHEDULED, ChangeState.IMPLEMENTING, ChangeState.IMPLEMENTED, ChangeState.FAILED, ChangeState.REJECTED,
    ChangeState.DEFERRED, ChangeState.CANCELLED, ChangeState.PENDING_REVIEW, ChangeState.CLOSED, ChangeState.DRAFT,
    ChangeState.PENDING_APPROVAL, ChangeState.SCHEDULED, ChangeState.APPROVED, ChangeState.CLOSED, ChangeState.IMPLEMENTING,
    ChangeState.SCHEDULED, ChangeState.PENDING_APPROVAL, ChangeState.ASSESSMENT, ChangeState.DRAFT, ChangeState.CLOSED,
    ChangeState.FAILED, ChangeState.IMPLEMENTED, ChangeState.SCHEDULED, ChangeState.PENDING_REVIEW, ChangeState.APPROVED,
    ChangeState.SUBMITTED, ChangeState.DRAFT, ChangeState.CLOSED, ChangeState.SCHEDULED,
  ];
  for (let index = 0; index < 34; index += 1) {
    const type = typeCycle[index % typeCycle.length];
    let state = stateCycle[index];
    if (state === (ChangeState.NORMAL as unknown as ChangeState) || !Object.values(ChangeState).includes(state)) state = ChangeState.DRAFT;
    if (type === ChangeType.EMERGENCY && state === ChangeState.ASSESSMENT) state = ChangeState.PENDING_APPROVAL;
    specs.push({
      type,
      state,
      risk: riskCycle[index % riskCycle.length],
      group: groupNames[index % groupNames.length],
      ci: ciNames[index % ciNames.length],
      service: serviceNames[index % serviceNames.length],
    });
  }
  specs[8].ci = "prod-web-01";
  specs[9].ci = "prod-web-01";
  specs[8].state = ChangeState.SCHEDULED;
  specs[9].state = ChangeState.SCHEDULED;

  const createdChanges = [];
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const start = day(index - 10, 9 + (index % 6));
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const outcome =
      spec.state === ChangeState.IMPLEMENTED || spec.state === ChangeState.CLOSED || spec.state === ChangeState.PENDING_REVIEW
        ? ImplementationOutcome.SUCCESS
        : spec.state === ChangeState.FAILED
          ? ImplementationOutcome.FAILURE
          : null;
    const change = await prisma.changeRequest.create({
      data: {
        number: await nextNumber("CHG"),
        shortDescription: `${spec.type.toLowerCase()} change ${index + 1}: ${spec.service} maintenance`,
        description: `Planned work on ${spec.ci} for ${spec.service}. This seeded record exercises ${spec.state}.`,
        type: spec.type,
        categoryId: changeCat.id,
        subcategoryId: changeSub.id,
        requestedById: id("requester@itsm.local"),
        changeOwnerId: id("owner@itsm.local"),
        implementationLeadId: id("implementer@itsm.local"),
        assignmentGroupId: groups.get(spec.group),
        assignedToId: id("implementer@itsm.local"),
        businessServiceId: services.get(spec.service),
        configurationItemId: cis.get(spec.ci),
        relatedIncidentId: incidents[index % incidents.length].id,
        relatedProblemId: problems[index % problems.length].id,
        businessImpact: spec.risk === RiskLevel.VERY_LOW ? ImpactLevel.LOW : (spec.risk as unknown as ImpactLevel),
        technicalImpact: ImpactLevel.MEDIUM,
        urgency: spec.risk === RiskLevel.VERY_HIGH || spec.risk === RiskLevel.HIGH ? Urgency.HIGH : Urgency.MEDIUM,
        probability: Probability.MEDIUM,
        priority: spec.risk === RiskLevel.VERY_HIGH ? "CRITICAL" : spec.risk === RiskLevel.HIGH ? "HIGH" : "MODERATE",
        impactedUsers: 25 + index,
        downtimeRequired: spec.risk === RiskLevel.HIGH || spec.risk === RiskLevel.VERY_HIGH,
        riskLevel: spec.risk,
        riskScore: 1.5 + (index % 5) * 0.4,
        riskExplanation: JSON.stringify({ summary: `${spec.risk} from seeded factors` }),
        plannedStart: start,
        plannedEnd: end,
        state: spec.state,
        approvalStatus: spec.state === ChangeState.REJECTED ? "REJECTED" : ["APPROVED", "SCHEDULED", "IMPLEMENTING", "IMPLEMENTED", "FAILED", "PENDING_REVIEW", "CLOSED", "DEFERRED"].includes(spec.state) ? "APPROVED" : spec.state === ChangeState.PENDING_APPROVAL ? "PENDING" : "NOT_REQUESTED",
        backoutRequired: spec.type === ChangeType.EMERGENCY || spec.risk === RiskLevel.HIGH || spec.risk === RiskLevel.VERY_HIGH,
        backoutPlan: "Restore the previous release and verify the health check.",
        emergencyJustification: spec.type === ChangeType.EMERGENCY ? "Production impact requires an emergency change." : null,
        implementationOutcome: outcome,
        implementationSummary: outcome ? "Seeded implementation result." : null,
        rollbackExecuted: spec.state === ChangeState.FAILED,
        pirRequired: spec.type === ChangeType.EMERGENCY || spec.risk === RiskLevel.HIGH || spec.risk === RiskLevel.VERY_HIGH,
        createdById: id("requester@itsm.local"),
        updatedById: id("change.manager@itsm.local"),
      },
    });
    createdChanges.push(change);
    await prisma.changeHistory.create({ data: { changeId: change.id, userId: id("requester@itsm.local"), action: "CREATE", newValue: change.number } });
    if (index < 12) {
      const task = await prisma.changeTask.create({
        data: { changeId: change.id, number: await nextNumber("CTASK"), description: "Prepare and validate the change", status: spec.state === ChangeState.CLOSED ? TaskStatus.COMPLETED : TaskStatus.PENDING, assigneeId: id("implementer@itsm.local"), assignmentGroupId: groups.get(spec.group) },
      });
      await prisma.changeTestCase.create({
        data: { changeId: change.id, description: "Service health check", expectedResults: "Health endpoint returns 200", status: spec.state === ChangeState.CLOSED ? TestStatus.PASSED : TestStatus.NOT_EXECUTED, actualResults: spec.state === ChangeState.CLOSED ? "200 OK" : null, ownerId: id("implementer@itsm.local") },
      });
      await prisma.changeNote.create({ data: { changeId: change.id, noteType: NoteType.WORK_NOTE, content: "Internal coordination note.", authorId: id("change.manager@itsm.local") } });
      await prisma.changeNote.create({ data: { changeId: change.id, noteType: NoteType.ADDITIONAL_COMMENT, content: "User-visible update.", authorId: id("requester@itsm.local") } });
      void task;
    }
    if (!["DRAFT", "SUBMITTED", "ASSESSMENT", "CANCELLED"].includes(spec.state)) {
      await prisma.changeApproval.create({
        data: {
          changeId: change.id,
          approvalType: spec.type === ChangeType.EMERGENCY ? ApprovalType.EMERGENCY : ApprovalType.TECHNICAL,
          sequence: 1,
          requiredRole: RoleName.TECHNICAL_APPROVER,
          approverId: id("tech.approver@itsm.local"),
          status: spec.state === ChangeState.PENDING_APPROVAL ? "PENDING" : spec.state === ChangeState.REJECTED ? "REJECTED" : "APPROVED",
          decidedById: spec.state === ChangeState.PENDING_APPROVAL ? null : id("tech.approver@itsm.local"),
          decidedAt: spec.state === ChangeState.PENDING_APPROVAL ? null : new Date(),
          comments: spec.state === ChangeState.REJECTED ? "Risk is not acceptable." : "Approved in seed.",
        },
      });
    }
    if (spec.state === ChangeState.CLOSED || spec.state === ChangeState.PENDING_REVIEW) {
      const pir = await prisma.changePir.create({
        data: {
          changeId: change.id,
          conductedById: id("change.manager@itsm.local"),
          conductedAt: new Date(),
          expectedVsActual: "Completed within the window.",
          successCriteriaMet: true,
          lessonsLearned: "Keep the rollback image staged.",
          result: spec.state === ChangeState.CLOSED ? PirResult.SUCCESSFUL : null,
        },
      });
      if (spec.state === ChangeState.CLOSED) {
        await prisma.pirAction.create({ data: { pirId: pir.id, description: "Update the standard patch template", ownerId: id("owner@itsm.local"), dueAt: day(14) } });
      }
    }
  }

  await prisma.maintenanceWindow.createMany({
    data: [
      { name: "Web weekend window", startAt: day(2, 1), endAt: day(2, 6), configurationItemId: cis.get("prod-web-01") },
      { name: "Payments window", startAt: day(5, 1), endAt: day(5, 5), businessServiceId: services.get("Payments") },
      { name: "Identity window", startAt: day(8, 2), endAt: day(8, 6), businessServiceId: services.get("Identity") },
    ],
  });
  await prisma.blackoutPeriod.createMany({
    data: [
      { name: "Firewall freeze", startAt: day(3, 0), endAt: day(4, 0), configurationItemId: cis.get("edge-firewall") },
      { name: "Payments freeze", startAt: day(6, 0), endAt: day(7, 0), businessServiceId: services.get("Payments") },
    ],
  });

  const meeting = await prisma.cabMeeting.create({
    data: {
      number: await nextNumber("CAB"),
      title: "Weekly CAB",
      startsAt: day(1, 15),
      endsAt: day(1, 16),
      createdById: id("change.manager@itsm.local"),
      members: { create: [{ userId: id("cab.member@itsm.local") }, { userId: id("change.manager@itsm.local") }] },
      agenda: { create: createdChanges.filter((change) => change.state === ChangeState.PENDING_APPROVAL).slice(0, 3).map((change) => ({ changeId: change.id, summary: change.shortDescription })) },
    },
  });
  const agenda = await prisma.cabAgendaItem.findFirst({ where: { meetingId: meeting.id } });
  if (agenda) {
    await prisma.cabDecision.create({ data: { meetingId: meeting.id, changeId: agenda.changeId, decision: CabDecisionType.MORE_INFO, comments: "Need a clearer rollback owner.", userId: id("cab.member@itsm.local") } });
  }
  await prisma.cabMeeting.create({
    data: {
      number: await nextNumber("CAB"),
      title: "Emergency CAB",
      startsAt: day(0, 18),
      endsAt: day(0, 19),
      createdById: id("change.manager@itsm.local"),
      members: { create: [{ userId: id("cab.member@itsm.local") }] },
    },
  });

  const counts = await prisma.changeRequest.groupBy({ by: ["state"], _count: { _all: true } });
  console.log(`Seeded ${createdChanges.length} changes`, counts.map((row) => `${row.state}:${row._count._all}`).join(", "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
