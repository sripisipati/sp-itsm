export const changeTypes = ["STANDARD", "NORMAL", "EMERGENCY"] as const;
export const impactLevels = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "VERY_LOW"] as const;
export const probabilities = ["HIGH", "MEDIUM", "LOW"] as const;
export const urgencies = ["HIGH", "MEDIUM", "LOW"] as const;
export const changeStates = [
  "DRAFT",
  "SUBMITTED",
  "ASSESSMENT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "IMPLEMENTING",
  "IMPLEMENTED",
  "FAILED",
  "REJECTED",
  "DEFERRED",
  "CANCELLED",
  "PENDING_REVIEW",
  "CLOSED",
] as const;
export const approvalStatuses = ["NOT_REQUESTED", "PENDING", "APPROVED", "REJECTED"] as const;
export const priorities = ["CRITICAL", "HIGH", "MODERATE", "LOW", "PLANNING"] as const;

export function pretty(value?: string | null): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
