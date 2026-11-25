import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

const password = "ChangeMe!Dev1";

describe("incident API", () => {
  let app: INestApplication;
  let admin = "";
  let requester = "";
  let readonlyToken = "";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    admin = await login("admin@itsm.local");
    requester = await login("requester.finance@itsm.local");
    readonlyToken = await login("readonly@itsm.local");
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

  it("creates an incident with a server ticket number and matrix priority", async () => {
    const response = await request(app.getHttpServer()).post("/api/v1/incidents").set(auth(admin)).send({
      shortDescription: "Integration priority check",
      description: "High impact and high urgency should calculate P1 from the matrix.",
      impact: "HIGH",
      urgency: "HIGH",
      severity: "CRITICAL",
      impactedUsers: 8,
    });
    expect(response.status).toBe(201);
    expect(response.body.data.ticketNumber).toMatch(/^INC\d{7}$/);
    expect(response.body.data.priority).toBe("P1");
    expect(response.body.data.status).toBe("NEW");
  });

  it("generates unique ticket numbers under concurrent creates", async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        request(app.getHttpServer()).post("/api/v1/incidents").set(auth(admin)).send({
          shortDescription: `Concurrent incident ${index} check`,
          description: "Concurrent ticket generation must not duplicate numbers.",
          impact: "LOW",
          urgency: "LOW",
          severity: "LOW",
        }),
      ),
    );
    const numbers = responses.map((response) => {
      expect(response.status).toBe(201);
      return response.body.data.ticketNumber as string;
    });
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("filters, sorts, and paginates on the server", async () => {
    const filtered = await request(app.getHttpServer())
      .get("/api/v1/incidents")
      .query({ ticketNumber: "INC0001001", severity: "CRITICAL", status: "IN_PROGRESS", description: "payroll" })
      .set(auth(admin));
    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].ticketNumber).toBe("INC0001001");
    expect(filtered.body.pagination.totalRecords).toBe(1);

    const page = await request(app.getHttpServer())
      .get("/api/v1/incidents")
      .query({ page: 1, pageSize: 10, sortBy: "ticketNumber", sortOrder: "asc" })
      .set(auth(admin));
    expect(page.body.pagination.pageSize).toBe(10);
    expect(page.body.pagination.totalRecords).toBeGreaterThanOrEqual(32);
    expect(page.body.data[0].ticketNumber).toBe("INC0001001");
    expect(page.body.data[0].ticketNumber < page.body.data[1].ticketNumber).toBe(true);
  });

  it("rejects an assignee outside the assignment group and an illegal status change", async () => {
    const created = await request(app.getHttpServer()).post("/api/v1/incidents").set(auth(admin)).send({
      shortDescription: "Assignment validation incident",
      description: "The assignee must be a member of the selected group.",
      impact: "MEDIUM",
      urgency: "MEDIUM",
      severity: "MEDIUM",
    });
    const groups = await request(app.getHttpServer()).get("/api/v1/assignment-groups").set(auth(admin));
    const network = groups.body.data.find((group: { name: string }) => group.name === "Service Desk");
    const users = await request(app.getHttpServer()).get("/api/v1/users").query({ search: "Jordan", pageSize: 5 }).set(auth(admin));
    const jordan = users.body.data.find((user: { email: string }) => user.email === "requester.finance@itsm.local");
    const invalid = await request(app.getHttpServer()).post(`/api/v1/incidents/${created.body.data.id}/assign`).set(auth(admin)).send({
      version: created.body.data.version,
      assignmentGroupId: network.id,
      assignedToId: jordan.id,
    });
    expect(invalid.status).toBe(400);

    const closed = await request(app.getHttpServer()).patch(`/api/v1/incidents/${created.body.data.id}/status`).set(auth(admin)).send({
      version: created.body.data.version,
      status: "CLOSED",
    });
    expect(closed.status).toBe(403);
  });

  it("requires resolution details, records history, and blocks stale versions", async () => {
    const created = await request(app.getHttpServer()).post("/api/v1/incidents").set(auth(admin)).send({
      shortDescription: "Resolution workflow incident",
      description: "Move this incident through progress and resolution.",
      impact: "MEDIUM",
      urgency: "HIGH",
      severity: "HIGH",
    });
    const id = created.body.data.id as string;
    let version = created.body.data.version as number;
    const progressed = await request(app.getHttpServer()).patch(`/api/v1/incidents/${id}/status`).set(auth(admin)).send({ version, status: "IN_PROGRESS" });
    expect(progressed.status).toBe(200);
    version = progressed.body.data.version;
    const missing = await request(app.getHttpServer()).patch(`/api/v1/incidents/${id}/status`).set(auth(admin)).send({ version, status: "RESOLVED" });
    expect(missing.status).toBe(400);
    const resolved = await request(app.getHttpServer()).patch(`/api/v1/incidents/${id}/status`).set(auth(admin)).send({
      version,
      status: "RESOLVED",
      resolutionCode: "SOLVED_PERMANENTLY",
      resolutionNotes: "The service was restored and confirmed by the caller.",
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.status).toBe("RESOLVED");
    const edited = await request(app.getHttpServer()).patch(`/api/v1/incidents/${id}`).set(auth(admin)).send({
      version: resolved.body.data.version,
      shortDescription: "Resolution workflow incident updated",
    });
    expect(edited.status).toBe(200);
    const history = await request(app.getHttpServer()).get(`/api/v1/incidents/${id}/history`).set(auth(admin));
    expect(history.body.data.some((entry: { actionType: string }) => entry.actionType === "RESOLVED")).toBe(true);
    expect(history.body.data.some((entry: { fieldName: string }) => entry.fieldName === "shortDescription")).toBe(true);
    const stale = await request(app.getHttpServer()).patch(`/api/v1/incidents/${id}/status`).set(auth(admin)).send({
      version,
      status: "CLOSED",
    });
    expect(stale.status).toBe(409);
  });

  it("hides work notes from requesters and enforces record scope", async () => {
    const users = await request(app.getHttpServer()).get("/api/v1/users").query({ search: "Jordan", pageSize: 5 }).set(auth(admin));
    const jordan = users.body.data.find((user: { email: string }) => user.email === "requester.finance@itsm.local");
    const created = await request(app.getHttpServer()).post("/api/v1/incidents").set(auth(admin)).send({
      shortDescription: "Requester visibility incident",
      description: "Jordan can see the comment but not the internal work note.",
      impact: "LOW",
      urgency: "MEDIUM",
      severity: "LOW",
      callerId: jordan.id,
      initialWorkNote: "Internal bridge check completed.",
      initialComment: "We are looking into this with you.",
    });
    expect(created.status).toBe(201);
    const hidden = await request(app.getHttpServer()).get(`/api/v1/incidents/${created.body.data.id}/notes`).set(auth(requester));
    expect(hidden.status).toBe(200);
    expect(hidden.body.data.every((note: { noteType: string }) => note.noteType !== "WORK_NOTE")).toBe(true);
    expect(hidden.body.data.some((note: { noteType: string }) => note.noteType === "ADDITIONAL_COMMENT")).toBe(true);
    const visible = await request(app.getHttpServer()).get(`/api/v1/incidents/${created.body.data.id}/notes`).set(auth(admin));
    expect(visible.body.data.some((note: { noteType: string }) => note.noteType === "WORK_NOTE")).toBe(true);

    const forbidden = await request(app.getHttpServer()).post("/api/v1/incidents").set(auth(readonlyToken)).send({
      shortDescription: "Readonly should fail",
      description: "Read only users cannot create incidents.",
      impact: "LOW",
      urgency: "LOW",
      severity: "LOW",
    });
    expect(forbidden.status).toBe(403);
  });

  it("returns summary counts from the database", async () => {
    const summary = await request(app.getHttpServer()).get("/api/v1/incidents/summary").set(auth(admin));
    expect(summary.status).toBe(200);
    expect(summary.body.data.total).toBeGreaterThanOrEqual(32);
    expect(summary.body.data.open + summary.body.data.resolved).toBeLessThanOrEqual(summary.body.data.total + summary.body.data.resolved);
  });
});
