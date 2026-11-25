import { z } from "zod";

export const changeFormSchema = z.object({
  shortDescription: z.string().trim().min(3, "Short description is required"),
  description: z.string().trim().min(3, "Detailed description is required"),
  type: z.enum(["STANDARD", "NORMAL", "EMERGENCY"]),
  businessJustification: z.string().optional(),
  emergencyJustification: z.string().optional(),
  businessImpact: z.string().optional(),
  technicalImpact: z.string().optional(),
  urgency: z.string().optional(),
  probability: z.string().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  backoutPlan: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.type === "EMERGENCY" && !value.emergencyJustification?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["emergencyJustification"], message: "Emergency justification is required" });
  }
  if (value.plannedStart && value.plannedEnd && new Date(value.plannedEnd) <= new Date(value.plannedStart)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["plannedEnd"], message: "Planned end must be after planned start" });
  }
});

export type ChangeFormValues = z.infer<typeof changeFormSchema>;
