import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, errorMessage } from "../../../shared/services/api";
import { useNotify } from "../../../app/notify";
import { formatDateTime } from "../../../shared/utilities/format";
import { label, priorityLabels, severityLabels, statusLabels } from "../../../shared/utilities/labels";
import { ActivityTimeline } from "../components/ActivityTimeline";
import type { IncidentDetail } from "../types";

interface Group { id: string; name: string; members: Array<{ id: string; name: string }> }

export function IncidentDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<"WORK_NOTE" | "ADDITIONAL_COMMENT">("ADDITIONAL_COMMENT");
  const [dialog, setDialog] = useState<"assign" | "status" | "note" | null>(params.get("action") === "assign" ? "assign" : params.get("action") === "status" ? "status" : null);
  const [groupId, setGroupId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [resolutionCode, setResolutionCode] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const incident = useQuery({
    queryKey: ["incident", id],
    queryFn: async () => (await api.get<{ data: IncidentDetail }>(`/incidents/${id}`)).data.data,
  });
  const groups = useQuery({ queryKey: ["groups"], queryFn: async () => (await api.get<{ data: Group[] }>("/assignment-groups")).data.data });
  const codes = useQuery({ queryKey: ["resolution-codes"], queryFn: async () => (await api.get<{ data: Array<{ code: string; label: string }> }>("/configuration/resolution-codes")).data.data });
  const record = incident.data;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["incident", id] });
    await queryClient.invalidateQueries({ queryKey: ["incidents"] });
  }

  const action = useMutation({
    mutationFn: async (task: () => Promise<unknown>) => task(),
    onSuccess: async () => {
      setDialog(null);
      notify("Incident updated.");
      await refresh();
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });

  async function upload(file: File) {
    const body = new FormData();
    body.append("file", file);
    await api.post(`/incidents/${id}/attachments`, body);
    notify("Attachment uploaded.");
    await refresh();
  }

  if (incident.isLoading) return <LinearProgress />;
  if (incident.isError || !record) return <Alert severity="error" action={<Button onClick={() => void incident.refetch()}>Retry</Button>}>{errorMessage(incident.error)}</Alert>;
  const members = groups.data?.find((group) => group.id === (groupId || record.assignmentGroupId))?.members ?? [];

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4">{record.ticketNumber}</Typography>
          <Typography color="text.secondary">{record.shortDescription}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {record.permissions.canEdit && <Button variant="contained" onClick={() => navigate(`/incidents/${record.id}/edit`)}>Edit</Button>}
          <Button variant="outlined" onClick={() => navigate(`/changes/new?incidentId=${record.id}`)}>Create change</Button>
          {record.permissions.canAssign && <Button variant="outlined" onClick={() => { setGroupId(record.assignmentGroupId ?? ""); setAssigneeId(record.assignedToId ?? ""); setDialog("assign"); }}>Assign</Button>}
          {record.permissions.canUpdateStatus && <Button variant="outlined" onClick={() => { setNextStatus(record.allowedTransitions[0] ?? record.status); setDialog("status"); }}>Update Status</Button>}
          {record.permissions.canAddWorkNote && <Button variant="outlined" onClick={() => { setNoteType("WORK_NOTE"); setDialog("note"); }}>Add Work Note</Button>}
          {record.permissions.canAddComment && <Button variant="outlined" onClick={() => { setNoteType("ADDITIONAL_COMMENT"); setDialog("note"); }}>Add Additional Comment</Button>}
          {record.permissions.canResolve && <Button color="success" variant="outlined" onClick={() => { setNextStatus("RESOLVED"); setResolutionCode(record.resolutionCode ?? ""); setResolutionNotes(record.resolutionNotes ?? ""); setDialog("status"); }}>Resolve</Button>}
          {record.permissions.canClose && <Button onClick={() => action.mutate(() => api.patch(`/incidents/${record.id}/status`, { version: record.version, status: "CLOSED" }))}>Close</Button>}
        </Box>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.2fr 0.8fr" }, gap: 2 }}>
        <Box sx={{ display: "grid", gap: 2 }}>
          <Info title="Incident overview" rows={[
            ["Status", label(statusLabels, record.status)],
            ["Priority", label(priorityLabels, record.priority)],
            ["Severity", label(severityLabels, record.severity)],
            ["Caller", record.caller?.name ?? "—"],
            ["Contact", record.contactInformation ?? "—"],
            ["Location", record.affectedLocation ?? "—"],
          ]} />
          <Info title="Classification" rows={[
            ["Category", record.category?.name ?? "—"],
            ["Subcategory", record.subcategory?.name ?? "—"],
            ["Impact", record.impact],
            ["Urgency", record.urgency],
            ["Impacted users", String(record.impactedUsers)],
            ["Configuration item", record.configurationItem?.name ?? "—"],
            ["Business service", record.businessService?.name ?? "—"],
          ]} />
          <Info title="Assignment" rows={[
            ["Group", record.assignmentGroup?.name ?? "—"],
            ["Assigned to", record.assignedTo?.name ?? "—"],
            ["Assigned on", formatDateTime(record.assignedOn)],
          ]} />
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Description</Typography>
            <Typography sx={{ whiteSpace: "pre-wrap", mt: 1 }}>{record.description}</Typography>
          </Paper>
          <Info title="Resolution" rows={[
            ["Code", record.resolutionCode ?? "—"],
            ["Notes", record.resolutionNotes ?? "—"],
            ["Resolved by", record.resolvedBy?.name ?? "—"],
            ["Resolved on", formatDateTime(record.resolvedOn)],
          ]} />
        </Box>
        <Box sx={{ display: "grid", gap: 2, alignContent: "start" }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Notes and comments</Typography>
            {record.notes.length === 0 && <Typography color="text.secondary">No notes.</Typography>}
            {[...record.notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((item) => (
              <Box key={item.id} sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{item.noteType === "WORK_NOTE" ? "Work note" : "Additional comment"} · {item.createdBy?.name} · {formatDateTime(item.createdAt)}</Typography>
                <Typography sx={{ whiteSpace: "pre-wrap" }}>{item.content}</Typography>
              </Box>
            ))}
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Attachments</Typography>
            {record.attachments.map((file) => (
              <Box key={file.id} sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 1 }}>
                <Button onClick={() => action.mutate(async () => {
                  const response = await api.get(`/incidents/${record.id}/attachments/${file.id}/download`, { responseType: "blob" });
                  const url = URL.createObjectURL(response.data);
                  window.open(url, "_blank");
                })}>{file.fileName}</Button>
                <Button color="error" onClick={() => action.mutate(() => api.delete(`/incidents/${record.id}/attachments/${file.id}`))}>Delete</Button>
              </Box>
            ))}
            {record.permissions.canUpload && <Button component="label" variant="outlined">Upload<input hidden type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file).catch((error) => notify(errorMessage(error), "error")); }} /></Button>}
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Activity timeline</Typography>
            <ActivityTimeline items={record.activity} />
          </Paper>
          {record.relatedChanges && record.relatedChanges.length > 0 && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Related changes</Typography>
              {record.relatedChanges.map((change) => (
                <Typography key={change.id} component={RouterLink} to={`/changes/${change.id}`} sx={{ display: "block" }}>
                  {change.number} · {change.state} · {change.shortDescription}
                </Typography>
              ))}
            </Paper>
          )}
          <Info title="Audit history" rows={[
            ["Created by", record.createdBy?.name ?? "—"],
            ["Created on", formatDateTime(record.createdAt)],
            ["Updated by", record.updatedBy?.name ?? "—"],
            ["Updated on", formatDateTime(record.updatedAt)],
            ["History entries", String(record.history.length)],
          ]} />
        </Box>
      </Box>
      <Dialog open={dialog === "assign"} onClose={() => setDialog(null)} fullWidth>
        <DialogTitle>Assign incident</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 1 }}>
          <TextField select label="Assignment Group" value={groupId} onChange={(event) => { setGroupId(event.target.value); setAssigneeId(""); }}>
            {groups.data?.map((group) => <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>)}
          </TextField>
          <TextField select label="Assigned To" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <MenuItem value="">Unassigned</MenuItem>
            {members.map((member) => <MenuItem key={member.id} value={member.id}>{member.name}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => action.mutate(() => api.post(`/incidents/${record.id}/assign`, { version: record.version, assignmentGroupId: groupId || null, assignedToId: assigneeId || null }))}>Save assignment</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={dialog === "status"} onClose={() => setDialog(null)} fullWidth>
        <DialogTitle>{nextStatus === "RESOLVED" ? "Resolve incident" : "Update status"}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: 1 }}>
          <TextField select label="Status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
            {record.allowedTransitions.map((value) => <MenuItem key={value} value={value}>{label(statusLabels, value)}</MenuItem>)}
          </TextField>
          {nextStatus === "RESOLVED" && (
            <>
              <TextField select label="Resolution Code" value={resolutionCode} onChange={(event) => setResolutionCode(event.target.value)}>
                {codes.data?.map((code) => <MenuItem key={code.code} value={code.code}>{code.label}</MenuItem>)}
              </TextField>
              <TextField label="Resolution Notes" multiline minRows={3} value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => action.mutate(() => api.patch(`/incidents/${record.id}/status`, { version: record.version, status: nextStatus, resolutionCode, resolutionNotes }))}>Update</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={dialog === "note"} onClose={() => setDialog(null)} fullWidth>
        <DialogTitle>{noteType === "WORK_NOTE" ? "Add work note" : "Add additional comment"}</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline minRows={3} value={note} onChange={(event) => setNote(event.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => action.mutate(async () => { await api.post(`/incidents/${record.id}/notes`, { noteType, content: note }); setNote(""); })}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Info({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>{title}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 1 }}>
        {rows.map(([name, value]) => (
          <Box key={name} sx={{ display: "contents" }}>
            <Typography color="text.secondary">{name}</Typography>
            <Typography>{value}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
