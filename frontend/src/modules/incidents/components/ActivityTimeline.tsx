import { Box, Paper, Typography } from "@mui/material";
import { formatDateTime } from "../../../shared/utilities/format";

export function ActivityTimeline({ items }: { items: Array<{ id: string; summary: string; detail?: string; occurredAt: string; actor: { name: string } | null }> }) {
  if (items.length === 0) return <Typography color="text.secondary">No activity yet.</Typography>;
  const ordered = [...items].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {ordered.map((item) => (
        <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 650 }}>{item.summary}</Typography>
          {item.detail && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>{item.detail}</Typography>}
          <Typography variant="caption" color="text.secondary">{item.actor?.name ?? "System"} · {formatDateTime(item.occurredAt)}</Typography>
        </Paper>
      ))}
    </Box>
  );
}
