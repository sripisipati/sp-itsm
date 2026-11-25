import { Alert, Box, Paper, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { api, errorMessage } from "../../shared/services/api";
import { pretty } from "../changes/options";

interface ProblemChange { id: string; number: string; shortDescription: string; state: string; type?: string }
interface Problem { id: string; number: string; shortDescription: string; state: string; changes: ProblemChange[] }

export function ProblemsPage() {
  const problems = useQuery({
    queryKey: ["problems"],
    queryFn: async () => (await api.get<{ data: Problem[] }>("/problems")).data.data,
  });
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h4">Problem Management</Typography>
        <Typography color="text.secondary">Problem records linked to the changes that address them.</Typography>
      </Box>
      {problems.isError && <Alert severity="error">{errorMessage(problems.error)}</Alert>}
      {(problems.data ?? []).map((problem) => (
        <Paper key={problem.id} sx={{ p: 2 }}>
          <Typography variant="h6"><RouterLink to={`/problems/${problem.id}`}>{problem.number}</RouterLink> · {problem.shortDescription}</Typography>
          <Typography variant="body2" color="text.secondary">{pretty(problem.state)} · {problem.changes.length} related changes</Typography>
        </Paper>
      ))}
      {!problems.isLoading && (problems.data?.length ?? 0) === 0 && <Typography color="text.secondary">No problem records.</Typography>}
    </Box>
  );
}

export function ProblemDetailPage() {
  const { id } = useParams();
  const problem = useQuery({
    queryKey: ["problem", id],
    queryFn: async () => (await api.get<{ data: Problem }>(`/problems/${id}`)).data.data,
  });
  if (problem.isError) return <Alert severity="error">{errorMessage(problem.error)}</Alert>;
  const record = problem.data;
  if (!record) return null;
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h4">{record.number}</Typography>
        <Typography color="text.secondary">{record.shortDescription} · {pretty(record.state)}</Typography>
      </Box>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Associated changes</Typography>
        {record.changes.length === 0 && <Typography color="text.secondary">No changes are linked to this problem.</Typography>}
        {record.changes.map((change) => (
          <Typography key={change.id} component={RouterLink} to={`/changes/${change.id}`} sx={{ display: "block", py: 0.5 }}>
            {change.number} · {pretty(change.state)} · {change.shortDescription}
          </Typography>
        ))}
      </Paper>
    </Box>
  );
}
