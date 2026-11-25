import { changeFormSchema } from "./changeSchema";

describe("change form schema", () => {
  it("requires an emergency justification", () => {
    const result = changeFormSchema.safeParse({
      shortDescription: "Patch firewall",
      description: "Apply the emergency rule change tonight.",
      type: "EMERGENCY",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a normal change with descriptions", () => {
    const result = changeFormSchema.safeParse({
      shortDescription: "Rotate certificate",
      description: "Replace the portal certificate during the window.",
      type: "NORMAL",
    });
    expect(result.success).toBe(true);
  });
});
