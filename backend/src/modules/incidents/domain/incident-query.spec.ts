import { Priority, RoleName, Severity } from "../../../generated/prisma/client";
import { AuthenticatedUser } from "../../../common/auth/authenticated-user";
import { buildIncidentOrder, buildIncidentWhere } from "./incident-query";

const manager: AuthenticatedUser = {
  id: "manager-1",
  email: "manager@itsm.local",
  employeeId: "E2",
  firstName: "Morgan",
  lastName: "Hale",
  roles: [RoleName.INCIDENT_MANAGER],
  groupIds: [],
};

describe("incident query builder", () => {
  it("combines text, severity, and status filters", () => {
    const where = buildIncidentWhere(
      {
        ticketNumber: "INC0001",
        description: "vpn",
        severity: Severity.HIGH,
        priority: Priority.P2,
        status: "NEW,IN_PROGRESS",
        search: "mail",
      },
      manager,
    );
    expect(JSON.stringify(where)).toContain("INC0001");
    expect(JSON.stringify(where)).toContain("vpn");
    expect(JSON.stringify(where)).toContain("HIGH");
    expect(JSON.stringify(where)).toContain("IN_PROGRESS");
    expect(JSON.stringify(where)).toContain("mail");
  });

  it("rejects an unknown status filter", () => {
    expect(() => buildIncidentWhere({ status: "DONE" }, manager)).toThrow("status filter");
  });

  it("whitelists sort fields and falls back safely", () => {
    expect(buildIncidentOrder({ sortBy: "ticketNumber", sortOrder: "asc" })).toEqual({ ticketNumber: "asc" });
    expect(buildIncidentOrder({ sortBy: "passwordHash", sortOrder: "desc" })).toEqual({ createdAt: "desc" });
  });

  it("scopes a requester to their own records", () => {
    const requester: AuthenticatedUser = { ...manager, id: "requester-1", roles: [RoleName.REQUESTER] };
    const where = buildIncidentWhere({}, requester);
    expect(JSON.stringify(where)).toContain("requester-1");
  });
});
