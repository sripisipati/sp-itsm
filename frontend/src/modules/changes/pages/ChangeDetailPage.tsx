import { Alert, Box, Button, LinearProgress, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNotify } from "../../../app/notify";
import { api, errorMessage } from "../../../shared/services/api";
import { formatDateTime } from "../../../shared/utilities/format";

interface Person { id: string; name: string | null }
interface Approval { id: string; approvalType: string; status: string; sequence: number; comments: string | null; approver: Person | null }
interface ChangeDetail {
  id: string;
  number: string;
  version: number;
  shortDescription: string;
  description: string;
  type: string;
  state: string;
  riskLevel: string | null;
  risk: { summary?: string } | null;
  priority: string | null;
  approvalStatus: string;
  businessImpact: string | null;
  technicalImpact: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  backoutPlan: string | null;
  emergencyJustification: string | null;
  implementationOutcome: string | null;
  requestedBy: Person | null;
  changeOwner: Person | null;
  assignmentGroup: { name: string } | null;
  relatedIncident: { id: string; ticketNumber: string; shortDescription: string } | null;
  relatedProblem: { id: string; number: string; shortDescription: string } | null;
  approvals: Approval[];
  notes: Array<{ id: string; noteType: string; content: string; createdAt: string; author: Person | null }>;
  tasks: Array<{ id: string; number: string; description: string; status: string }>;
  taskProgress: { total: number; completed: number; percent: number };
  pir: { result: string | null; lessonsLearned: string | null } | null;
}

export function ChangeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("SUCCESS");
  const change = useQuery({
    queryKey: ["change", id],
    queryFn: async () => (await api.get<{ data: ChangeDetail }>(`/changes/${id}`)).data.data,
  });
  const action = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSuccess: async () => {
      notify("Change updated");
      await queryClient.invalidateQueries({ queryKey: ["change", id] });
      await queryClient.invalidateQueries({ queryKey: ["changes"] });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const record = change.data;
  if (change.isLoading) return <LinearProgress />;
  if (change.isError || !record) return <Alert severity="error">{errorMessage(change.error)}</Alert>;

  function post(path: string, body: object) {
    action.mutate(() => api.post(path, body));
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4">{record.number}</Typography>
          <Typography color="text.secondary">{record.shortDescription}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button variant="outlined" onClick={() => navigate(`/changes/${record.id}/edit`)}>Edit</Button>
          {record.state === "DRAFT" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/submit`, { version: record.version })}>Submit</Button>}
          {record.state === "ASSESSMENT" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/assess`, { version: record.version, complete: true })}>Complete assessment</Button>}
          {record.state === "APPROVED" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "SCHEDULED", version: record.version })}>Schedule</Button>}
          {record.state === "SCHEDULED" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "IMPLEMENTING", version: record.version })}>Start implementation</Button>}
          {record.state === "IMPLEMENTING" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "IMPLEMENTED", version: record.version, implementationOutcome: outcome })}>Mark implemented</Button>}
          {record.state === "PENDING_REVIEW" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "CLOSED", version: record.version })}>Close</Button>}
        </Box>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { md: "2fr 1fr" }, gap: 2 }}>
        <Paper sx={{ p: 2, display: "grid", gap: 1 }}>
          <Typography variant="h6">Change information</Typography>
          <Typography>{record.description}</Typography>
          <Info rows={[
            ["Type", record.type],
            ["State", record.state],
            ["Risk", record.riskLevel ?? "Unset"],
            ["Risk explanation", record.risk?.summary ?? ""],
            ["Priority", record.priority ?? ""],
            ["Impact", `${record.businessImpact ?? "—"} / ${record.technicalImpact ?? "—"}`],
            ["Approval", record.approvalStatus],
            ["Planned", `${formatDateTime(record.plannedStart)} – ${formatDateTime(record.plannedEnd)}`],
            ["Requested by", record.requestedBy?.name ?? "—"],
            ["Owner", record.changeOwner?.name ?? "—"],
            ["Group", record.assignmentGroup?.name ?? "—"],
            ["Related incident", record.relatedIncident ? `${record.relatedIncident.ticketNumber} ${record.relatedIncident.shortDescription}` : "—"],
            ["Related problem", record.relatedProblem ? `${record.relatedProblem.number} ${record.relatedProblem.shortDescription}` : "—"],
            ["Backout", record.backoutPlan ?? "—"],
            ["Emergency justification", record.emergencyJustification ?? "—"],
            ["Tasks", `${record.taskProgress.completed}/${record.taskProgress.total} (${record.taskProgress.percent}%)`],
            ["PIR", record.pir?.result ?? "Not recorded"],
          ]} />
          {record.state === "IMPLEMENTING" && (
            <TextField select label="Implementation outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)}>
              <MenuItem value="SUCCESS">Success</MenuItem>
              <MenuItem value="PARTIAL">Partial</MenuItem>
              <MenuItem value="FAILURE">Failure</MenuItem>
            </TextField>
          )}
        </Paper>
        <Paper sx={{ p: 2, display: "grid", gap: 1 }}>
          <Typography variant="h6">Approvals</Typography>
          {record.approvals.map((approval) => (
            <Box key={approval.id} sx={{ borderBottom: 1, borderColor: "divider", pb: 1 }}>
              <Typography variant="body2">{approval.approvalType} · seq {approval.sequence} · {approval.status}</Typography>
              <Typography variant="caption">{approval.approver?.name ?? "Unassigned"} {approval.comments ? `— ${approval.comments}` : ""}</Typography>
              {approval.status === "PENDING" && (
                <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                  <Button size="small" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/approvals/${approval.id}/decision`, { decision: "APPROVED", comments: comment, version: record.version })}>Approve</Button>
                  <Button size="small" color="error" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/approvals/${approval.id}/decision`, { decision: "REJECTED", comments: comment || "Rejected", version: record.version })}>Reject</Button>
                </Box>
              )}
            </Box>
          ))}
          <TextField size="small" label="Approval comment" value={comment} onChange={(event) => setComment(event.target.value)} />
        </Paper>
      </Box>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Notes</Typography>
        {record.notes.map((item) => (
          <Typography key={item.id} variant="body2" sx={{ py: 0.5 }}>{formatDateTime(item.createdAt)} · {item.author?.name} · {item.noteType}: {item.content}</Typography>
        ))}
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <TextField size="small" fullWidth label="Additional comment" value={note} onChange={(event) => setNote(event.target.value)} />
          <Button disabled={action.isPending || !note.trim()} onClick={() => { post(`/changes/${record.id}/notes`, { noteType: "ADDITIONAL_COMMENT", content: note }); setNote(""); }}>Add</Button>
        </Box>
      </Paper>
    </Box>
  );
}

function Info({ rows }: { rows: Array<[string, string]> }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 0.5 }}>
      {rows.map(([label, value]) => (
        <Box key={label} sx={{ display: "contents" }}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="body2">{value}</Typography>
        </Box>
      ))}
    </Box>
  );
}
