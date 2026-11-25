import { Paper, Typography } from "@mui/material";

export function SummaryCards({ total, open, inProgress, resolved }: { total: number; open: number; inProgress: number; resolved: number }) {
  const cards = [
    ["Total Incidents", total],
    ["Open Incidents", open],
    ["In Progress", inProgress],
    ["Resolved", resolved],
  ] as const;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
      {cards.map(([title, value]) => (
        <Paper key={title} sx={{ p: 2 }} data-testid={`summary-${title}`}>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
          <Typography variant="h4">{value}</Typography>
        </Paper>
      ))}
    </div>
  );
}
