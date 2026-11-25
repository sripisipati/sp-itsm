import { incidentSchema } from "./incidentSchema";

describe("incidentSchema", () => {
  it("requires a description and a group before an assignee", () => {
    const result = incidentSchema.safeParse({
      shortDescription: "VPN down",
      description: "too short",
      impact: "HIGH",
      urgency: "HIGH",
      severity: "CRITICAL",
      impactedUsers: 4,
      assignedToId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a complete incident", () => {
    const result = incidentSchema.safeParse({
      shortDescription: "VPN drops for finance",
      description: "The finance floor loses the payroll tunnel every few minutes.",
      impact: "HIGH",
      urgency: "HIGH",
      severity: "CRITICAL",
      impactedUsers: 12,
    });
    expect(result.success).toBe(true);
  });
});
