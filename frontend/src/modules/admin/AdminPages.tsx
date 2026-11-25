import { Alert, LinearProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "../../shared/services/api";

export function UsersAdminPage() {
  return <SimpleTable title="Users" path="/users" columns={["name", "email", "employeeId", "roles"]} />;
}

export function GroupsAdminPage() {
  const query = useQuery({ queryKey: ["groups"], queryFn: async () => (await api.get<{ data: Array<{ id: string; name: string; description: string | null; members: Array<{ name: string }> }> }>("/assignment-groups")).data.data });
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>Assignment Groups</Typography>
      {query.isLoading && <LinearProgress />}
      {query.isError && <Alert severity="error">{errorMessage(query.error)}</Alert>}
      <Table size="small">
        <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Description</TableCell><TableCell>Members</TableCell></TableRow></TableHead>
        <TableBody>
          {query.data?.map((group) => (
            <TableRow key={group.id}><TableCell>{group.name}</TableCell><TableCell>{group.description}</TableCell><TableCell>{group.members.map((member) => member.name).join(", ")}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

export function CategoriesAdminPage() {
  return <SimpleTable title="Categories" path="/categories" columns={["name", "parentId", "isActive"]} />;
}

export function ConfigurationItemsPage() {
  return <SimpleTable title="Configuration Items" path="/configuration-items" columns={["name", "ciType", "description"]} />;
}

export function SettingsPage() {
  const matrix = useQuery({ queryKey: ["matrix"], queryFn: async () => (await api.get<{ data: Array<{ impact: string; urgency: string; calculatedPriority: string }> }>("/configuration/priority-matrix")).data.data });
  const transitions = useQuery({ queryKey: ["transitions"], queryFn: async () => (await api.get<{ data: Array<{ fromStatus: string; toStatus: string }> }>("/configuration/status-transitions")).data.data });
  return (
    <Paper sx={{ p: 2, display: "grid", gap: 2 }}>
      <Typography variant="h4">System Settings</Typography>
      <Typography color="text.secondary">Priority and status rules are stored in the database and enforced by the API.</Typography>
      {matrix.isError && <Alert severity="error">{errorMessage(matrix.error)}</Alert>}
      <Typography variant="h6">Priority matrix</Typography>
      <Table size="small">
        <TableHead><TableRow><TableCell>Impact</TableCell><TableCell>Urgency</TableCell><TableCell>Priority</TableCell></TableRow></TableHead>
        <TableBody>{matrix.data?.map((row) => <TableRow key={`${row.impact}-${row.urgency}`}><TableCell>{row.impact}</TableCell><TableCell>{row.urgency}</TableCell><TableCell>{row.calculatedPriority}</TableCell></TableRow>)}</TableBody>
      </Table>
      <Typography variant="h6">Status transitions</Typography>
      <Table size="small">
        <TableHead><TableRow><TableCell>From</TableCell><TableCell>To</TableCell></TableRow></TableHead>
        <TableBody>{transitions.data?.map((row) => <TableRow key={`${row.fromStatus}-${row.toStatus}`}><TableCell>{row.fromStatus}</TableCell><TableCell>{row.toStatus}</TableCell></TableRow>)}</TableBody>
      </Table>
    </Paper>
  );
}

function SimpleTable({ title, path, columns }: { title: string; path: string; columns: string[] }) {
  const query = useQuery({
    queryKey: ["admin", path],
    queryFn: async () => (await api.get<{ data: Array<Record<string, unknown>> }>(path, { params: { pageSize: 100 } })).data.data,
  });
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>{title}</Typography>
      {query.isLoading && <LinearProgress />}
      {query.isError && <Alert severity="error">{errorMessage(query.error)}</Alert>}
      <Table size="small">
        <TableHead><TableRow>{columns.map((column) => <TableCell key={column}>{column}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {query.data?.map((row, index) => (
            <TableRow key={String(row.id ?? index)}>
              {columns.map((column) => <TableCell key={column}>{formatCell(row[column])}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
