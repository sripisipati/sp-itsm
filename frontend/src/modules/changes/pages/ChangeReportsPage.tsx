import { Alert, Box, Paper, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "../../../shared/services/api";
import { pretty } from "../options";

interface Reports {
  byStatus: Array<{ state: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  byRisk: Array<{ risk: string | null; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byAssignmentGroup: Array<{ groupName: string; count: number }>;
  byRequester: Array<{ name: string; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
  byConfigurationItem: Array<{ name: string; count: number }>;
  percentages: { successful: number; failed: number; emergency: number };
  rollbackCount: number;
  changesLinkedToIncidents: number;
  approvalTurnaroundHours: number | null;
  plannedDurationHours: number | null;
  actualDurationHours: number | null;
}

export function ChangeReportsPage() {
  const reports = useQuery({
    queryKey: ["change-reports"],
    queryFn: async () => (await api.get<{ data: Reports }>("/changes/reports")).data.data,
  });
  if (reports.isError) return <Alert severity="error">{errorMessage(reports.error)}</Alert>;
  const data = reports.data;
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h4">Change reports</Typography>
        <Typography color="text.secondary">Counts and durations are calculated from change records.</Typography>
      </Box>
      {data && (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 1 }}>
            <Metric label="Successful" value={`${data.percentages.successful}%`} />
            <Metric label="Failed" value={`${data.percentages.failed}%`} />
            <Metric label="Emergency" value={`${data.percentages.emergency}%`} />
            <Metric label="Rollbacks" value={String(data.rollbackCount)} />
            <Metric label="Linked incidents" value={String(data.changesLinkedToIncidents)} />
            <Metric label="Approval turnaround" value={durationLabel(data.approvalTurnaroundHours)} />
            <Metric label="Planned duration" value={durationLabel(data.plannedDurationHours)} />
            <Metric label="Actual duration" value={durationLabel(data.actualDurationHours)} />
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { md: "1fr 1fr" }, gap: 1 }}>
            <Bars title="By status" rows={data.byStatus.map((row) => ({ label: pretty(row.state), count: row.count }))} />
            <Bars title="By type" rows={data.byType.map((row) => ({ label: pretty(row.type), count: row.count }))} />
            <Bars title="By risk" rows={data.byRisk.map((row) => ({ label: pretty(row.risk), count: row.count }))} />
            <Bars title="By priority" rows={data.byPriority.map((row) => ({ label: pretty(row.priority), count: row.count }))} />
            <Bars title="By assignment group" rows={data.byAssignmentGroup.map((row) => ({ label: row.groupName, count: row.count }))} />
            <Bars title="By requester" rows={data.byRequester.map((row) => ({ label: row.name, count: row.count }))} />
            <Bars title="By month" rows={data.byMonth.map((row) => ({ label: String(row.month).slice(0, 7), count: row.count }))} />
            <Bars title="By configuration item" rows={data.byConfigurationItem.map((row) => ({ label: row.name, count: row.count }))} />
          </Box>
        </>
      )}
    </Box>
  );
}

function durationLabel(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 1 / 60) return "< 1 min";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours} h`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Paper sx={{ p: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6">{value}</Typography>
    </Paper>
  );
}

function Bars({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Paper sx={{ p: 1.5 }}>
      <Typography variant="subtitle2" gutterBottom>{title}</Typography>
      {rows.filter((row) => row.count > 0).map((row) => (
        <Box key={row.label} sx={{ display: "grid", gridTemplateColumns: "140px 1fr 32px", gap: 1, alignItems: "center", mb: 0.5 }}>
          <Typography variant="caption" noWrap>{row.label}</Typography>
          <Box sx={{ height: 8, bgcolor: "action.hover", borderRadius: 1 }}><Box sx={{ width: `${(row.count / max) * 100}%`, height: "100%", bgcolor: "primary.main", borderRadius: 1 }} /></Box>
          <Typography variant="caption">{row.count}</Typography>
        </Box>
      ))}
    </Paper>
  );
}
