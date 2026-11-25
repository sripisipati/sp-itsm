import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

const password = "ChangeMe!Dev1";

describe("change API", () => {
  let app: INestApplication;
  let admin = "";
  let requester = "";
  let tech = "";
  let readonlyToken = "";
  let manager = "";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    admin = await login("admin@itsm.local");
    requester = await login("requester@itsm.local");
    tech = await login("tech.approver@itsm.local");
    readonlyToken = await login("readonly@itsm.local");
    manager = await login("change.manager@itsm.local");
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password });
    expect(response.status).toBe(201);
    return response.body.data.accessToken as string;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it("creates a change with a server number and calculated risk", async () => {
    const preview = await request(app.getHttpServer()).post("/api/v1/changes/preview-classification").set(auth(admin)).send({
      type: "NORMAL",
      businessImpact: "HIGH",
      technicalImpact: "MEDIUM",
      urgency: "HIGH",
      probability: "MEDIUM",
      downtimeRequired: true,
      impactedUsers: 40,
    });
    expect(preview.status).toBe(201);
    expect(preview.body.data.level).toBeTruthy();
    expect(preview.body.data.priority).toBe("HIGH");

    const created = await request(app.getHttpServer()).post("/api/v1/changes").set(auth(requester)).send({
      shortDescription: "Rotate the portal certificate",
      description: "Replace the expiring certificate during the maintenance window.",
      type: "NORMAL",
      businessImpact: "HIGH",
      technicalImpact: "MEDIUM",
      urgency: "HIGH",
      probability: "MEDIUM",
      downtimeRequired: false,
      impactedUsers: 20,
      backoutPlan: "Restore the previous certificate.",
    });
    expect(created.status).toBe(201);
    expect(created.body.data.number).toMatch(/^CHG\d{7}$/);
    expect(created.body.data.riskLevel).toBeTruthy();
    expect(created.body.data.relatedIncident).toBeNull();
  });

  it("allocates unique change numbers under concurrency", async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        request(app.getHttpServer()).post("/api/v1/changes").set(auth(admin)).send({
          shortDescription: `Concurrent change ${index} number`,
          description: "Concurrent numbering must stay unique.",
          type: "STANDARD",
        }),
      ),
    );
    const numbers = responses.map((response) => {
      expect(response.status).toBe(201);
      return response.body.data.number as string;
    });
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("filters on the server and rejects a read-only mutation", async () => {
    const filtered = await request(app.getHttpServer()).get("/api/v1/changes").query({ type: "EMERGENCY", pageSize: 10 }).set(auth(admin));
    expect(filtered.status).toBe(200);
    expect(filtered.body.pagination.totalRecords).toBeGreaterThan(0);
    expect(filtered.body.data.every((row: { type: string }) => row.type === "EMERGENCY")).toBe(true);

    const denied = await request(app.getHttpServer()).post("/api/v1/changes").set(auth(readonlyToken)).send({
      shortDescription: "Readonly should fail",
      description: "Read only users cannot create changes.",
      type: "STANDARD",
    });
    expect(denied.status).toBe(403);
  });

  it("runs sequential approval, rejection, and blocks self-approval", async () => {
    const created = await request(app.getHttpServer()).post("/api/v1/changes").set(auth(requester)).send({
      shortDescription: "High risk firewall rule",
      description: "Open a temporary rule for the vendor cutover.",
      type: "NORMAL",
      businessImpact: "VERY_HIGH",
      technicalImpact: "HIGH",
      urgency: "HIGH",
      probability: "HIGH",
      downtimeRequired: true,
      impactedUsers: 200,
      backoutPlan: "Remove the temporary rule.",
    });
    expect(created.body.data.riskLevel === "HIGH" || created.body.data.riskLevel === "VERY_HIGH").toBe(true);
    const id = created.body.data.id as string;
    let version = created.body.data.version as number;
    const submitted = await request(app.getHttpServer()).post(`/api/v1/changes/${id}/submit`).set(auth(requester)).send({ version });
    expect(submitted.status).toBe(201);
    const afterSubmit = await request(app.getHttpServer()).get(`/api/v1/changes/${id}`).set(auth(manager));
    const assessed = await request(app.getHttpServer()).post(`/api/v1/changes/${id}/assess`).set(auth(manager)).send({ version: afterSubmit.body.data.version, complete: true, assessmentSummary: "Risk accepted for CAB." });
    expect([200, 201]).toContain(assessed.status);
    const detail = await request(app.getHttpServer()).get(`/api/v1/changes/${id}`).set(auth(manager));
    version = detail.body.data.version as number;
    expect(detail.body.data.state).toBe("PENDING_APPROVAL");
    const first = detail.body.data.approvals[0];
    const self = await request(app.getHttpServer()).post(`/api/v1/changes/${id}/approvals/${first.id}/decision`).set(auth(requester)).send({ decision: "APPROVED", version, comments: "I approve my own change" });
    expect(self.status).toBe(403);
    const approved = await request(app.getHttpServer()).post(`/api/v1/changes/${id}/approvals/${first.id}/decision`).set(auth(tech)).send({ decision: "APPROVED", version, comments: "Technical review passed" });
    expect(approved.status).toBe(201);
    const after = await request(app.getHttpServer()).get(`/api/v1/changes/${id}`).set(auth(admin));
    expect(after.body.data.approvals[0].status).toBe("APPROVED");
    expect(after.body.data.state).not.toBe("APPROVED");
  });

  it("rejects a change and records history and a version conflict", async () => {
    const created = await request(app.getHttpServer()).post("/api/v1/changes").set(auth(admin)).send({
      shortDescription: "Reject this standard change",
      description: "A standard template change that will be rejected.",
      type: "STANDARD",
      businessImpact: "LOW",
      urgency: "LOW",
      probability: "LOW",
      impactedUsers: 2,
    });
    const id = created.body.data.id as string;
    const submitted = await request(app.getHttpServer()).post(`/api/v1/changes/${id}/submit`).set(auth(admin)).send({ version: created.body.data.version });
    expect(submitted.status).toBe(201);
    const detail = await request(app.getHttpServer()).get(`/api/v1/changes/${id}`).set(auth(admin));
    const approval = detail.body.data.approvals[0];
    const rejected = await request(app.getHttpServer()).post(`/api/v1/changes/${id}/approvals/${approval.id}/decision`).set(auth(tech)).send({
      decision: "REJECTED",
      version: detail.body.data.version,
      comments: "Window is not justified",
    });
    expect(rejected.status).toBe(201);
    const after = await request(app.getHttpServer()).get(`/api/v1/changes/${id}`).set(auth(admin));
    expect(after.body.data.state).toBe("REJECTED");
    const scheduled = await request(app.getHttpServer()).patch(`/api/v1/changes/${id}/state`).set(auth(manager)).send({ toState: "SCHEDULED", version: after.body.data.version });
    expect(scheduled.status).toBe(400);
    const stale = await request(app.getHttpServer()).patch(`/api/v1/changes/${id}`).set(auth(admin)).send({
      version: 1,
      shortDescription: "Stale edit",
      description: "This version is no longer current.",
      type: "STANDARD",
    });
    expect(stale.status).toBe(409);
    const history = await request(app.getHttpServer()).get(`/api/v1/changes/${id}/history`).set(auth(admin));
    expect(history.body.data.some((entry: { action: string }) => entry.action.includes("REJECTED"))).toBe(true);
  });

  it("hides work notes from requesters and links an incident", async () => {
    const incidents = await request(app.getHttpServer()).get("/api/v1/incidents").query({ ticketNumber: "INC0001001" }).set(auth(admin));
    const incidentId = incidents.body.data[0].id as string;
    const created = await request(app.getHttpServer()).post("/api/v1/changes").set(auth(manager)).send({
      shortDescription: "Linked payroll remediation",
      description: "Change linked to the payroll incident. Completing it must not close the incident.",
      type: "NORMAL",
      relatedIncidentId: incidentId,
      businessImpact: "MEDIUM",
      urgency: "MEDIUM",
      probability: "MEDIUM",
      impactedUsers: 15,
    });
    const id = created.body.data.id as string;
    expect(created.body.data.relatedIncident.ticketNumber).toBe("INC0001001");
    await request(app.getHttpServer()).post(`/api/v1/changes/${id}/notes`).set(auth(manager)).send({ noteType: "WORK_NOTE", content: "Internal bridge only." });
    await request(app.getHttpServer()).post(`/api/v1/changes/${id}/notes`).set(auth(manager)).send({ noteType: "ADDITIONAL_COMMENT", content: "Visible update." });
    const hidden = await request(app.getHttpServer()).get(`/api/v1/changes/${id}/notes`).set(auth(requester));
    expect(hidden.body.data.every((note: { noteType: string }) => note.noteType !== "WORK_NOTE")).toBe(true);
    const incident = await request(app.getHttpServer()).get(`/api/v1/incidents/${incidentId}`).set(auth(admin));
    expect(incident.body.data.status).toBe("IN_PROGRESS");
    expect(incident.body.data.relatedChanges.some((change: { id: string }) => change.id === id)).toBe(true);
  });

  it("validates tasks, tests, conflicts, and summary counts", async () => {
    const created = await request(app.getHttpServer()).post("/api/v1/changes").set(auth(admin)).send({
      shortDescription: "Task and test validation",
      description: "Exercise task dependencies and test results.",
      type: "STANDARD",
    });
    const id = created.body.data.id as string;
    const task = await request(app.getHttpServer()).post(`/api/v1/changes/${id}/tasks`).set(auth(admin)).send({ description: "Prepare the package" });
    expect(task.body.data.number).toMatch(/^CTASK/);
    const blocked = await request(app.getHttpServer()).post(`/api/v1/changes/${id}/test-cases`).set(auth(admin)).send({
      description: "Smoke test",
      expectedResults: "Health is green",
      status: "PASSED",
    });
    expect(blocked.status).toBe(400);
    const passed = await request(app.getHttpServer()).post(`/api/v1/changes/${id}/test-cases`).set(auth(admin)).send({
      description: "Smoke test",
      expectedResults: "Health is green",
      status: "PASSED",
      actualResults: "200 OK",
    });
    expect(passed.status).toBe(201);
    const summary = await request(app.getHttpServer()).get("/api/v1/changes/summary").set(auth(admin));
    expect(summary.body.data.cards.total).toBeGreaterThanOrEqual(34);
    const conflicts = await request(app.getHttpServer()).get("/api/v1/changes/conflicts").query({
      plannedStart: new Date(Date.now() + 86400000).toISOString(),
      plannedEnd: new Date(Date.now() + 90000000).toISOString(),
    }).set(auth(admin));
    expect(conflicts.status).toBe(200);
    expect(Array.isArray(conflicts.body.data.conflicts)).toBe(true);
  });
});
