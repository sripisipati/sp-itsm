export const statusLabels: Record<string, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const priorityLabels: Record<string, string> = {
  P1: "P1 - Critical",
  P2: "P2 - High",
  P3: "P3 - Medium",
  P4: "P4 - Low",
};

export const severityLabels: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const impactLabels: Record<string, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const statuses = Object.keys(statusLabels);
export const priorities = Object.keys(priorityLabels);
export const severities = Object.keys(severityLabels);
export const impacts = Object.keys(impactLabels);

export function label(map: Record<string, string>, value?: string | null): string {
  if (!value) return "—";
  return map[value] ?? value;
}
