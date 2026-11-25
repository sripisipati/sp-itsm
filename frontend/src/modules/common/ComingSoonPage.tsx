import { Paper, Typography } from "@mui/material";

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>{title}</Typography>
      <Typography color="text.secondary">This module is on the platform roadmap and will be introduced without changing the Incident Management workspace.</Typography>
    </Paper>
  );
}
