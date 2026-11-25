import { Alert, Box, Button, LinearProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { api, errorMessage } from "../../../shared/services/api";
import { formatDateTime } from "../../../shared/utilities/format";
import { label, priorityLabels, statusLabels } from "../../../shared/utilities/labels";

interface DashboardData {
  total: number;
  open: number;
  inProgress: number;
  critical: number;
  resolved: number;
  byStatus: Array<{ status: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byAssignmentGroup: Array<{ name: string; count: number }>;
  recentlyCreated: Array<{ id: string; ticketNumber: string; shortDescription: string; status: string; createdAt: string }>;
  myAssigned: Array<{ id: string; ticketNumber: string; shortDescription: string; status: string; priority: string }>;
}

function Bars({ rows }: { rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      {rows.map((row) => (
        <Box key={row.label}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
            <Typography variant="body2">{row.label}</Typography>
            <Typography variant="body2" color="text.secondary">{row.count}</Typography>
          </Box>
          <LinearProgress variant="determinate" value={(row.count / max) * 100} sx={{ height: 8, borderRadius: 99 }} />
        </Box>
      ))}
      {rows.length === 0 && <Typography color="text.secondary">No records yet.</Typography>}
    </Box>
  );
}

export function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<{ data: DashboardData }>("/dashboard")).data.data,
  });
  if (query.isLoading) return <LinearProgress />;
  if (query.isError) return <Alert severity="error" action={<Button onClick={() => void query.refetch()}>Retry</Button>}>{errorMessage(query.error)}</Alert>;
  const data = query.data;
  if (!data) return null;
  const cards = [
    ["Total Incidents", data.total],
    ["Open Incidents", data.open],
    ["In Progress", data.inProgress],
    ["Critical Incidents", data.critical],
    ["Resolved Incidents", data.resolved],
  ] as const;

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h4">Dashboard</Typography>
        <Typography color="text.secondary">Live incident workload from the service database.</Typography>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, gap: 1.5 }}>
        {cards.map(([title, value]) => (
          <Paper key={title} sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">{title}</Typography>
            <Typography variant="h4">{value}</Typography>
          </Paper>
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr 1fr" }, gap: 2 }}>
        <Paper sx={{ p: 2 }}><Typography variant="h6" gutterBottom>Incidents by Status</Typography><Bars rows={data.byStatus.map((row) => ({ label: label(statusLabels, row.status), count: row.count }))} /></Paper>
        <Paper sx={{ p: 2 }}><Typography variant="h6" gutterBottom>Incidents by Priority</Typography><Bars rows={data.byPriority.map((row) => ({ label: label(priorityLabels, row.priority), count: row.count }))} /></Paper>
        <Paper sx={{ p: 2 }}><Typography variant="h6" gutterBottom>Incidents by Assignment Group</Typography><Bars rows={data.byAssignmentGroup.map((row) => ({ label: row.name, count: row.count }))} /></Paper>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Recently Created</Typography>
          <MiniTable rows={data.recentlyCreated} />
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>My Assigned Incidents</Typography>
          <MiniTable rows={data.myAssigned} />
        </Paper>
      </Box>
    </Box>
  );
}

function MiniTable({ rows }: { rows: Array<{ id: string; ticketNumber: string; shortDescription: string; status: string; createdAt?: string }> }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Ticket</TableCell>
          <TableCell>Description</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Created</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length === 0 && <TableRow><TableCell colSpan={4}>Nothing in this list.</TableCell></TableRow>}
        {rows.map((row) => (
          <TableRow key={row.id} hover>
            <TableCell><RouterLink to={`/incidents/${row.id}`}>{row.ticketNumber}</RouterLink></TableCell>
            <TableCell>{row.shortDescription}</TableCell>
            <TableCell>{label(statusLabels, row.status)}</TableCell>
            <TableCell>{formatDateTime(row.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
