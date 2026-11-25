import { Impact, IncidentStatus, Priority, Urgency } from "../../../generated/prisma/client";

export interface PriorityRule {
  impact: Impact;
  urgency: Urgency;
  calculatedPriority: Priority;
  isActive: boolean;
}

export interface TransitionRule {
  fromStatus: IncidentStatus;
  toStatus: IncidentStatus;
  isActive: boolean;
}

export function resolvePriority(rules: PriorityRule[], impact: Impact, urgency: Urgency): Priority | null {
  const match = rules.find((rule) => rule.isActive && rule.impact === impact && rule.urgency === urgency);
  return match?.calculatedPriority ?? null;
}

export function formatTicketNumber(prefix: string, sequence: number, pad: number): string {
  if (!/^[A-Z]{2,8}$/.test(prefix)) {
    throw new Error("Ticket prefix is invalid");
  }
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new Error("Ticket sequence must be a non-negative integer");
  }
  if (!Number.isInteger(pad) || pad < 4 || pad > 12) {
    throw new Error("Ticket pad length is invalid");
  }
  return `${prefix}${String(sequence).padStart(pad, "0")}`;
}

export function isTransitionAllowed(rules: TransitionRule[], from: IncidentStatus, to: IncidentStatus): boolean {
  if (from === to) return true;
  return rules.some((rule) => rule.isActive && rule.fromStatus === from && rule.toStatus === to);
}

export function allowedTargets(rules: TransitionRule[], from: IncidentStatus): IncidentStatus[] {
  return rules.filter((rule) => rule.isActive && rule.fromStatus === from).map((rule) => rule.toStatus);
}

export const OPEN_STATUSES: IncidentStatus[] = [
  IncidentStatus.NEW,
  IncidentStatus.ASSIGNED,
  IncidentStatus.IN_PROGRESS,
  IncidentStatus.ON_HOLD,
];

export function isTerminalStatus(status: IncidentStatus): boolean {
  return status === IncidentStatus.CLOSED || status === IncidentStatus.CANCELLED;
}
