import { Alert, Box, Button, LinearProgress, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useNotify } from "../../../app/notify";
import { UserLookup } from "../../../shared/components/UserLookup";
import { api, errorMessage } from "../../../shared/services/api";
import { formatDateTime } from "../../../shared/utilities/format";
import { ActivityTimeline } from "../../incidents/components/ActivityTimeline";
import { pretty } from "../options";

interface Person { id: string; name?: string | null; firstName?: string | null; lastName?: string | null }
interface Approval {
  id: string;
  approvalType: string;
  status: string;
  sequence: number;
  comments: string | null;
  dueAt: string | null;
  decidedAt: string | null;
  approver: Person | null;
  delegatedTo: Person | null;
  decidedBy: Person | null;
}
interface Task {
  id: string;
  number: string;
  description: string;
  instructions: string | null;
  status: string;
  estimatedMinutes: number | null;
  completionComments: string | null;
  assignee: Person | null;
  dependencies: Array<{ dependsOnId: string }>;
}
interface TestCase {
  id: string;
  description: string;
  expectedResults: string;
  actualResults: string | null;
  status: string;
  validationCriteria: string | null;
}
interface Note { id: string; noteType: string; content: string; createdAt: string; author: Person | null }
interface Attachment { id: string; fileName: string; fileSize: number; uploadedAt: string; uploadedBy: Person | null }
interface ChangeDetail {
  id: string;
  number: string;
  version: number;
  shortDescription: string;
  description: string;
  type: string;
  state: string;
  riskLevel: string | null;
  riskScore: number | null;
  risk: { summary?: string } | null;
  priority: string | null;
  approvalStatus: string;
  businessImpact: string | null;
  technicalImpact: string | null;
  urgency: string | null;
  probability: string | null;
  impactedUsers: number | null;
  downtimeRequired: boolean;
  estimatedDowntimeMinutes: number | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  backoutRequired: boolean;
  backoutPlan: string | null;
  backoutTriggerConditions: string | null;
  rollbackSteps: string | null;
  rollbackExecuted: boolean;
  emergencyJustification: string | null;
  businessJustification: string | null;
  implementationOutcome: string | null;
  implementationSummary: string | null;
  testPlan: string | null;
  requestedBy: Person | null;
  requestedFor: Person | null;
  changeOwner: Person | null;
  implementationLead: Person | null;
  changeCoordinator: Person | null;
  assignedTo: Person | null;
  assignmentGroup: { name: string } | null;
  category: { name: string } | null;
  subcategory: { name: string } | null;
  businessService: { name: string } | null;
  configurationItem: { name: string } | null;
  relatedIncident: { id: string; ticketNumber: string; shortDescription: string } | null;
  relatedProblem: { id: string; number: string; shortDescription: string } | null;
  affectedCis: Array<{ configurationItem: { name: string } }>;
  affectedServices: Array<{ businessService: { name: string } }>;
  approvals: Approval[];
  notes: Note[];
  tasks: Task[];
  testCases: TestCase[];
  attachments: Attachment[];
  taskProgress: { total: number; completed: number; percent: number };
  pir: { result: string | null; lessonsLearned: string | null; expectedVsActual: string | null; actions: Array<{ id: string; description: string }> } | null;
  pirRequired: boolean;
  createdBy: Person | null;
  updatedBy: Person | null;
  createdAt: string;
  updatedAt: string;
  scheduleOverrideJustification: string | null;
}

function nameOf(person?: Person | null): string {
  if (!person) return "—";
  if (person.name) return person.name;
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || "—";
}

export function ChangeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [delegateId, setDelegateId] = useState("");
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("ADDITIONAL_COMMENT");
  const [outcome, setOutcome] = useState("SUCCESS");
  const [justification, setJustification] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskInstructions, setTaskInstructions] = useState("");
  const [testDescription, setTestDescription] = useState("");
  const [expectedResults, setExpectedResults] = useState("");
  const [pirLessons, setPirLessons] = useState("");
  const [pirResult, setPirResult] = useState("SUCCESSFUL");
  const [followUp, setFollowUp] = useState("");
  const change = useQuery({
    queryKey: ["change", id],
    queryFn: async () => (await api.get<{ data: ChangeDetail }>(`/changes/${id}`)).data.data,
  });
  const history = useQuery({
    queryKey: ["change-history", id],
    queryFn: async () => (await api.get<{ data: Array<{ id: string; action: string; field: string | null; oldValue: string | null; newValue: string | null; comment: string | null; createdAt: string; user: { name: string } | null }> }>(`/changes/${id}/history`)).data.data,
  });
  const action = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSuccess: async () => {
      notify("Change updated");
      await queryClient.invalidateQueries({ queryKey: ["change", id] });
      await queryClient.invalidateQueries({ queryKey: ["change-history", id] });
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
  function patch(path: string, body: object) {
    action.mutate(() => api.patch(path, body));
  }

  async function upload(file: File) {
    if (!record) return;
    const body = new FormData();
    body.append("file", file);
    await api.post(`/changes/${record.id}/attachments`, body);
    notify("Attachment uploaded");
    await queryClient.invalidateQueries({ queryKey: ["change", id] });
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4">{record.number}</Typography>
          <Typography color="text.secondary">{record.shortDescription}</Typography>
          <Typography variant="body2">{pretty(record.type)} · {record.state}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button variant="outlined" onClick={() => navigate(`/changes/${record.id}/edit`)}>Edit</Button>
          {record.state === "DRAFT" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/submit`, { version: record.version })}>Submit</Button>}
          {(record.state === "DRAFT" || record.state === "SUBMITTED") && <Button disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "CANCELLED", version: record.version, justification })}>Cancel</Button>}
          {record.state === "ASSESSMENT" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/assess`, { version: record.version, complete: true })}>Complete assessment</Button>}
          {record.state === "APPROVED" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "SCHEDULED", version: record.version, justification })}>Schedule</Button>}
          {record.state === "APPROVED" && <Button disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "DEFERRED", version: record.version, justification })}>Defer</Button>}
          {record.state === "SCHEDULED" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "IMPLEMENTING", version: record.version, justification })}>Start implementation</Button>}
          {record.state === "IMPLEMENTING" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "IMPLEMENTED", version: record.version, implementationOutcome: outcome })}>Mark implemented</Button>}
          {record.state === "IMPLEMENTING" && <Button color="error" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "FAILED", version: record.version, implementationOutcome: "FAILURE" })}>Mark failed</Button>}
          {record.state === "FAILED" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "PENDING_REVIEW", version: record.version, rollbackExecuted: true, justification })}>Rollback and review</Button>}
          {record.state === "IMPLEMENTED" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "PENDING_REVIEW", version: record.version })}>Send to review</Button>}
          {record.state === "PENDING_REVIEW" && <Button variant="contained" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/state`, { toState: "CLOSED", version: record.version })}>Close</Button>}
        </Box>
      </Box>
      <TextField size="small" label="Transition justification" value={justification} onChange={(event) => setJustification(event.target.value)} helperText="Required to override a scheduling conflict, a blackout, or an early implementation window." />
      <Box sx={{ display: "grid", gridTemplateColumns: { md: "2fr 1fr" }, gap: 2 }}>
        <Box sx={{ display: "grid", gap: 2, alignContent: "start" }}>
          <Paper sx={{ p: 2, display: "grid", gap: 1 }}>
            <Typography variant="h6">Change information</Typography>
            <Typography sx={{ whiteSpace: "pre-wrap" }}>{record.description}</Typography>
            <Info rows={[
              ["Type", pretty(record.type)],
              ["State", record.state],
              ["Category", `${record.category?.name ?? "—"} / ${record.subcategory?.name ?? "—"}`],
              ["Requested by", nameOf(record.requestedBy)],
              ["Requested for", nameOf(record.requestedFor)],
              ["Business justification", record.businessJustification ?? "—"],
              ["Service", record.businessService?.name ?? "—"],
              ["Configuration item", record.configurationItem?.name ?? "—"],
              ["Affected services", record.affectedServices.map((item) => item.businessService.name).join(", ") || "—"],
              ["Affected CIs", record.affectedCis.map((item) => item.configurationItem.name).join(", ") || "—"],
              ["Related incident", record.relatedIncident ? `${record.relatedIncident.ticketNumber} ${record.relatedIncident.shortDescription}` : "—"],
              ["Related problem", record.relatedProblem ? `${record.relatedProblem.number} ${record.relatedProblem.shortDescription}` : "—"],
              ["Emergency justification", record.emergencyJustification ?? "—"],
            ]} />
            {record.relatedIncident && <Button component={RouterLink} to={`/incidents/${record.relatedIncident.id}`}>Open incident</Button>}
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Risk and impact</Typography>
            <Alert severity={record.riskLevel === "HIGH" || record.riskLevel === "VERY_HIGH" ? "warning" : "info"} sx={{ my: 1 }}>
              {pretty(record.riskLevel)} · score {record.riskScore ?? "—"} · {record.risk?.summary}
            </Alert>
            <Info rows={[
              ["Priority", pretty(record.priority)],
              ["Business impact", pretty(record.businessImpact)],
              ["Technical impact", pretty(record.technicalImpact)],
              ["Urgency", pretty(record.urgency)],
              ["Probability", pretty(record.probability)],
              ["Impacted users", record.impactedUsers == null ? "—" : String(record.impactedUsers)],
              ["Downtime", record.downtimeRequired ? `${record.estimatedDowntimeMinutes ?? "—"} minutes` : "Not required"],
            ]} />
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Schedule and assignment</Typography>
            <Info rows={[
              ["Planned", `${formatDateTime(record.plannedStart)} – ${formatDateTime(record.plannedEnd)}`],
              ["Actual", `${formatDateTime(record.actualStart)} – ${formatDateTime(record.actualEnd)}`],
              ["Owner", nameOf(record.changeOwner)],
              ["Implementation lead", nameOf(record.implementationLead)],
              ["Coordinator", nameOf(record.changeCoordinator)],
              ["Assigned to", nameOf(record.assignedTo)],
              ["Group", record.assignmentGroup?.name ?? "—"],
              ["Schedule override", record.scheduleOverrideJustification ?? "—"],
            ]} />
          </Paper>
          <Paper sx={{ p: 2, display: "grid", gap: 1 }}>
            <Typography variant="h6">Implementation tasks · {record.taskProgress.completed}/{record.taskProgress.total} ({record.taskProgress.percent}%)</Typography>
            <LinearProgress variant="determinate" value={record.taskProgress.percent} />
            {record.tasks.map((task) => (
              <Box key={task.id} sx={{ borderBottom: 1, borderColor: "divider", pb: 1 }}>
                <Typography variant="body2">{task.number} · {task.description} · {pretty(task.status)}</Typography>
                <Typography variant="caption">{task.instructions} {nameOf(task.assignee)} {task.dependencies.length ? `· depends on ${task.dependencies.length}` : ""}</Typography>
                {task.status !== "COMPLETED" && (
                  <Button size="small" disabled={action.isPending} onClick={() => patch(`/changes/${record.id}/tasks/${task.id}`, { description: task.description, status: "COMPLETED", completionComments: "Completed from the change record" })}>Complete</Button>
                )}
              </Box>
            ))}
            <TextField size="small" label="Task description" value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} />
            <TextField size="small" label="Execution instructions" value={taskInstructions} onChange={(event) => setTaskInstructions(event.target.value)} />
            <Button disabled={action.isPending || taskDescription.trim().length < 3} onClick={() => { post(`/changes/${record.id}/tasks`, { description: taskDescription, instructions: taskInstructions }); setTaskDescription(""); setTaskInstructions(""); }}>Add task</Button>
          </Paper>
          <Paper sx={{ p: 2, display: "grid", gap: 1 }}>
            <Typography variant="h6">Testing and validation</Typography>
            <Typography variant="body2">{record.testPlan || "No test plan recorded."}</Typography>
            {record.testCases.map((test) => (
              <Box key={test.id}>
                <Typography variant="body2">{test.description} · expected {test.expectedResults} · {pretty(test.status)}</Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {["PASSED", "FAILED", "BLOCKED", "NOT_EXECUTED"].map((status) => (
                    <Button key={status} size="small" disabled={action.isPending} onClick={() => patch(`/changes/${record.id}/test-cases/${test.id}`, {
                      description: test.description,
                      expectedResults: test.expectedResults,
                      validationCriteria: test.validationCriteria,
                      status,
                      actualResults: status === "NOT_EXECUTED" ? test.actualResults : (test.actualResults || "Recorded from the change record"),
                    })}>{pretty(status)}</Button>
                  ))}
                </Box>
              </Box>
            ))}
            <TextField size="small" label="Test case" value={testDescription} onChange={(event) => setTestDescription(event.target.value)} />
            <TextField size="small" label="Expected results" value={expectedResults} onChange={(event) => setExpectedResults(event.target.value)} />
            <Button disabled={action.isPending || testDescription.trim().length < 3 || !expectedResults.trim()} onClick={() => { post(`/changes/${record.id}/test-cases`, { description: testDescription, expectedResults }); setTestDescription(""); setExpectedResults(""); }}>Add test case</Button>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Backout and results</Typography>
            <Info rows={[
              ["Backout required", record.backoutRequired ? "Yes" : "No"],
              ["Backout plan", record.backoutPlan ?? "—"],
              ["Trigger conditions", record.backoutTriggerConditions ?? "—"],
              ["Rollback steps", record.rollbackSteps ?? "—"],
              ["Rollback executed", record.rollbackExecuted ? "Yes" : "No"],
              ["Outcome", pretty(record.implementationOutcome)],
              ["Summary", record.implementationSummary ?? "—"],
            ]} />
            {record.state === "IMPLEMENTING" && (
              <TextField select label="Implementation outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} sx={{ mt: 1 }}>
                <MenuItem value="SUCCESS">Success</MenuItem>
                <MenuItem value="PARTIAL">Partial</MenuItem>
                <MenuItem value="FAILURE">Failure</MenuItem>
              </TextField>
            )}
          </Paper>
          <Paper sx={{ p: 2, display: "grid", gap: 1 }}>
            <Typography variant="h6">Post-implementation review {record.pirRequired ? "(required)" : ""}</Typography>
            <Typography variant="body2">Result: {pretty(record.pir?.result)} {record.pir?.lessonsLearned ? `· ${record.pir.lessonsLearned}` : ""}</Typography>
            {record.pir?.actions.map((item) => <Typography key={item.id} variant="body2">Follow-up: {item.description}</Typography>)}
            <TextField select size="small" label="PIR result" value={pirResult} onChange={(event) => setPirResult(event.target.value)}>
              <MenuItem value="SUCCESSFUL">Successful</MenuItem>
              <MenuItem value="PARTIAL">Partial</MenuItem>
              <MenuItem value="UNSUCCESSFUL">Unsuccessful</MenuItem>
            </TextField>
            <TextField size="small" label="Lessons learned" value={pirLessons} onChange={(event) => setPirLessons(event.target.value)} />
            <TextField size="small" label="Follow-up action" value={followUp} onChange={(event) => setFollowUp(event.target.value)} />
            <Button disabled={action.isPending} onClick={() => post(`/changes/${record.id}/pir`, { version: record.version, result: pirResult, lessonsLearned: pirLessons, expectedVsActual: record.pir?.expectedVsActual, actions: followUp.trim() ? [{ description: followUp }] : record.pir?.actions.map((item) => ({ description: item.description })) })}>Save PIR</Button>
          </Paper>
        </Box>
        <Box sx={{ display: "grid", gap: 2, alignContent: "start" }}>
          <Paper sx={{ p: 2, display: "grid", gap: 1 }}>
            <Typography variant="h6">Approvals · {pretty(record.approvalStatus)}</Typography>
            {record.approvals.length === 0 && <Typography variant="body2" color="text.secondary">No approvals have been requested.</Typography>}
            {record.approvals.map((approval) => (
              <Box key={approval.id} sx={{ borderBottom: 1, borderColor: "divider", pb: 1 }}>
                <Typography variant="body2">{pretty(approval.approvalType)} · sequence {approval.sequence} · {pretty(approval.status)}</Typography>
                <Typography variant="caption">{nameOf(approval.approver)} {approval.delegatedTo ? `delegated to ${nameOf(approval.delegatedTo)}` : ""} {approval.decidedAt ? `· ${formatDateTime(approval.decidedAt)} by ${nameOf(approval.decidedBy)}` : ""} {approval.comments ? `— ${approval.comments}` : ""}</Typography>
                {approval.status === "PENDING" && (
                  <Box sx={{ display: "flex", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                    <Button size="small" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/approvals/${approval.id}/decision`, { decision: "APPROVED", comments: comment, version: record.version })}>Approve</Button>
                    <Button size="small" color="error" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/approvals/${approval.id}/decision`, { decision: "REJECTED", comments: comment || "Rejected", version: record.version })}>Reject</Button>
                    <Button size="small" disabled={action.isPending} onClick={() => post(`/changes/${record.id}/approvals/${approval.id}/decision`, { decision: "MORE_INFO", comments: comment || "More information is required", version: record.version })}>Request information</Button>
                    <Button size="small" disabled={action.isPending || !delegateId} onClick={() => post(`/changes/${record.id}/approvals/${approval.id}/decision`, { decision: "DELEGATED", comments: comment, delegateUserId: delegateId, version: record.version })}>Delegate</Button>
                  </Box>
                )}
              </Box>
            ))}
            <TextField size="small" label="Approval comment" value={comment} onChange={(event) => setComment(event.target.value)} />
            <UserLookup label="Delegate to" value={delegateId} onChange={setDelegateId} />
          </Paper>
          <Paper sx={{ p: 2, display: "grid", gap: 1 }}>
            <Typography variant="h6">Notes and activity</Typography>
            {record.notes.map((item) => (
              <Typography key={item.id} variant="body2">{formatDateTime(item.createdAt)} · {nameOf(item.author)} · {pretty(item.noteType)}: {item.content}</Typography>
            ))}
            <TextField select size="small" label="Note type" value={noteType} onChange={(event) => setNoteType(event.target.value)}>
              <MenuItem value="WORK_NOTE">Work note</MenuItem>
              <MenuItem value="ADDITIONAL_COMMENT">Additional comment</MenuItem>
              <MenuItem value="APPROVAL_COMMENT">Approval comment</MenuItem>
            </TextField>
            <TextField size="small" label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
            <Button disabled={action.isPending || !note.trim()} onClick={() => { post(`/changes/${record.id}/notes`, { noteType, content: note }); setNote(""); }}>Add note</Button>
          </Paper>
          <Paper sx={{ p: 2, display: "grid", gap: 1 }}>
            <Typography variant="h6">Attachments</Typography>
            {record.attachments.map((file) => (
              <Button key={file.id} sx={{ justifyContent: "flex-start" }} onClick={() => action.mutate(async () => {
                const response = await api.get(`/changes/${record.id}/attachments/${file.id}/download`, { responseType: "blob" });
                const url = URL.createObjectURL(response.data);
                window.open(url, "_blank");
              })}>{file.fileName} · {nameOf(file.uploadedBy)} · {formatDateTime(file.uploadedAt)}</Button>
            ))}
            <Button component="label" variant="outlined">Upload<input hidden type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file).catch((error) => notify(errorMessage(error), "error")); }} /></Button>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Activity timeline</Typography>
            <ActivityTimeline items={(history.data ?? []).map((item) => ({
              id: item.id,
              summary: pretty(item.action),
              detail: [item.field, item.oldValue && item.newValue ? `${item.oldValue} → ${item.newValue}` : item.newValue, item.comment].filter(Boolean).join(" · "),
              occurredAt: item.createdAt,
              actor: item.user,
            }))} />
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Audit</Typography>
            <Info rows={[
              ["Created by", nameOf(record.createdBy)],
              ["Created on", formatDateTime(record.createdAt)],
              ["Updated by", nameOf(record.updatedBy)],
              ["Updated on", formatDateTime(record.updatedAt)],
            ]} />
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

function Info({ rows }: { rows: Array<[string, string]> }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 0.5, mt: 1 }}>
      {rows.map(([label, value]) => (
        <Box key={label} sx={{ display: "contents" }}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="body2">{value}</Typography>
        </Box>
      ))}
    </Box>
  );
}
