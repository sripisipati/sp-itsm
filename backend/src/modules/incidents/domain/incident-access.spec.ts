import { IncidentStatus, RoleName } from "../../../generated/prisma/client";
import { AuthenticatedUser } from "../../../common/auth/authenticated-user";
import { canSeeWorkNotes, canViewIncident, permissionsFor } from "./incident-access";

function user(roles: RoleName[], id = "user-1", groupIds: string[] = []): AuthenticatedUser {
  return {
    id,
    email: "user@itsm.local",
    employeeId: "E1",
    firstName: "Test",
    lastName: "User",
    roles,
    groupIds,
  };
}

const incident = {
  status: IncidentStatus.IN_PROGRESS,
  assignedToId: "agent-1",
  assignmentGroupId: "group-1",
  createdById: "requester-1",
  callerId: "requester-1",
};

describe("incident access", () => {
  it("lets a requester view only their own incidents", () => {
    const requester = user([RoleName.REQUESTER], "requester-1");
    expect(canViewIncident(requester, incident)).toBe(true);
    expect(canViewIncident(requester, { ...incident, createdById: "other", callerId: "other" })).toBe(false);
  });

  it("hides work notes from requester-only users", () => {
    expect(canSeeWorkNotes(user([RoleName.REQUESTER]))).toBe(false);
    expect(canSeeWorkNotes(user([RoleName.SUPPORT_AGENT]))).toBe(true);
    expect(canSeeWorkNotes(user([RoleName.READ_ONLY]))).toBe(true);
  });

  it("lets an agent update group incidents but resolve only assigned ones", () => {
    const agent = user([RoleName.SUPPORT_AGENT], "agent-2", ["group-1"]);
    const permissions = permissionsFor(agent, incident);
    expect(permissions.canEdit).toBe(true);
    expect(permissions.canResolve).toBe(false);
    expect(permissionsFor(user([RoleName.SUPPORT_AGENT], "agent-1", ["group-1"]), incident).canResolve).toBe(true);
  });

  it("blocks read-only users from changes", () => {
    const permissions = permissionsFor(user([RoleName.READ_ONLY]), incident);
    expect(permissions.canEdit).toBe(false);
    expect(permissions.canAddComment).toBe(false);
    expect(canViewIncident(user([RoleName.READ_ONLY]), incident)).toBe(true);
  });

  it("lets managers resolve and close", () => {
    const permissions = permissionsFor(user([RoleName.INCIDENT_MANAGER]), incident);
    expect(permissions.canResolve).toBe(true);
    expect(permissions.canClose).toBe(true);
  });
});
