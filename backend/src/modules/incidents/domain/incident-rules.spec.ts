import { Impact, IncidentStatus, Priority, Urgency } from "../../../generated/prisma/client";
import { formatTicketNumber, isTransitionAllowed, resolvePriority } from "./incident-rules";

const matrix = [
  { impact: Impact.HIGH, urgency: Urgency.HIGH, calculatedPriority: Priority.P1, isActive: true },
  { impact: Impact.HIGH, urgency: Urgency.MEDIUM, calculatedPriority: Priority.P2, isActive: true },
  { impact: Impact.MEDIUM, urgency: Urgency.MEDIUM, calculatedPriority: Priority.P3, isActive: true },
  { impact: Impact.LOW, urgency: Urgency.LOW, calculatedPriority: Priority.P4, isActive: false },
];

describe("incident rules", () => {
  it("resolves priority from an active matrix row", () => {
    expect(resolvePriority(matrix, Impact.HIGH, Urgency.HIGH)).toBe(Priority.P1);
    expect(resolvePriority(matrix, Impact.HIGH, Urgency.MEDIUM)).toBe(Priority.P2);
  });

  it("ignores inactive matrix rows", () => {
    expect(resolvePriority(matrix, Impact.LOW, Urgency.LOW)).toBeNull();
  });

  it("formats ticket numbers with a fixed width", () => {
    expect(formatTicketNumber("INC", 1001, 7)).toBe("INC0001001");
    expect(formatTicketNumber("INC", 1032, 7)).toBe("INC0001032");
  });

  it("rejects an unsafe ticket prefix", () => {
    expect(() => formatTicketNumber("inc", 1, 7)).toThrow("Ticket prefix is invalid");
  });

  it("allows only configured status transitions", () => {
    const rules = [
      { fromStatus: IncidentStatus.NEW, toStatus: IncidentStatus.ASSIGNED, isActive: true },
      { fromStatus: IncidentStatus.NEW, toStatus: IncidentStatus.CLOSED, isActive: false },
    ];
    expect(isTransitionAllowed(rules, IncidentStatus.NEW, IncidentStatus.ASSIGNED)).toBe(true);
    expect(isTransitionAllowed(rules, IncidentStatus.NEW, IncidentStatus.CLOSED)).toBe(false);
    expect(isTransitionAllowed(rules, IncidentStatus.NEW, IncidentStatus.NEW)).toBe(true);
  });
});
