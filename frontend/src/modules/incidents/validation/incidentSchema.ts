import { z } from "zod";

const optionalId = z.string().uuid().or(z.literal("")).optional();

export const incidentSchema = z.object({
  shortDescription: z.string().trim().min(5, "Enter a short description of at least 5 characters.").max(200),
  description: z.string().trim().min(10, "Enter a detailed description of at least 10 characters.").max(8000),
  categoryId: optionalId,
  subcategoryId: optionalId,
  callerId: optionalId,
  contactInformation: z.string().max(500).optional(),
  configurationItemId: optionalId,
  businessServiceId: optionalId,
  affectedLocation: z.string().max(200).optional(),
  impact: z.enum(["HIGH", "MEDIUM", "LOW"]),
  urgency: z.enum(["HIGH", "MEDIUM", "LOW"]),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  impactedUsers: z.coerce.number().int().min(0).max(1_000_000),
  assignmentGroupId: optionalId,
  assignedToId: optionalId,
  resolutionCode: z.string().max(80).optional(),
  resolutionNotes: z.string().max(8000).optional(),
  initialComment: z.string().max(8000).optional(),
  initialWorkNote: z.string().max(8000).optional(),
}).superRefine((value, context) => {
  if (value.assignedToId && !value.assignmentGroupId) {
    context.addIssue({ code: "custom", path: ["assignedToId"], message: "Select an assignment group before assigning a user." });
  }
});

export type IncidentFormValues = z.infer<typeof incidentSchema>;

export const emptyIncidentForm: IncidentFormValues = {
  shortDescription: "",
  description: "",
  categoryId: "",
  subcategoryId: "",
  callerId: "",
  contactInformation: "",
  configurationItemId: "",
  businessServiceId: "",
  affectedLocation: "",
  impact: "MEDIUM",
  urgency: "MEDIUM",
  severity: "MEDIUM",
  impactedUsers: 1,
  assignmentGroupId: "",
  assignedToId: "",
  resolutionCode: "",
  resolutionNotes: "",
  initialComment: "",
  initialWorkNote: "",
};
