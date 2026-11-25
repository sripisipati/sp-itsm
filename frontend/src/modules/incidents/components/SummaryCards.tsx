import { Box } from "@mui/material";
import { MetricCard, metricTones } from "../../../shared/components/MetricCard";

const OPEN = "NEW,ASSIGNED,IN_PROGRESS,ON_HOLD";

const cards = [
  { key: "total", label: "Total Incidents", tone: metricTones.indigo, status: "" },
  { key: "open", label: "Open Incidents", tone: metricTones.amber, status: OPEN },
  { key: "inProgress", label: "In Progress", tone: metricTones.cyan, status: "IN_PROGRESS" },
  { key: "resolved", label: "Resolved", tone: metricTones.green, status: "RESOLVED" },
] as const;

function sameFilter(current: string, expected: string): boolean {
  const normalize = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean).sort().join(",");
  return normalize(current) === normalize(expected);
}

export function SummaryCards({
  total,
  open,
  inProgress,
  resolved,
  status = "",
  onSelect,
}: {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  status?: string;
  onSelect?: (status: string) => void;
}) {
  const values = { total, open, inProgress, resolved };
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 2, pb: 1.5, pt: 0.5 }}>
      {cards.map((card) => (
        <MetricCard
          key={card.key}
          label={card.label}
          value={values[card.key]}
          tone={card.tone}
          selected={card.status ? sameFilter(status, card.status) : status === ""}
          onClick={() => onSelect?.(card.status && sameFilter(status, card.status) ? "" : card.status)}
        />
      ))}
    </Box>
  );
}
