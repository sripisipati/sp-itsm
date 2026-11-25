import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useNotify } from "../../../app/notify";
import { api, errorMessage } from "../../../shared/services/api";
import { formatDateTime } from "../../../shared/utilities/format";
import { pretty } from "../options";

interface AgendaItem {
  id: string;
  changeId: string;
  summary: string | null;
  decision: string | null;
  comments: string | null;
  change: { id: string; number: string; shortDescription: string; riskLevel: string | null; state: string };
}
interface Meeting {
  id: string;
  number: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  minutes: string | null;
  agenda: AgendaItem[];
  members: Array<{ userId: string }>;
}

export function CabMeetingsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [changeId, setChangeId] = useState("");
  const [comments, setComments] = useState("");
  const meetings = useQuery({
    queryKey: ["cab-meetings"],
    queryFn: async () => (await api.get<{ data: Meeting[] }>("/cab/meetings")).data.data,
  });
  const changes = useQuery({
    queryKey: ["cab-change-options"],
    queryFn: async () => (await api.get<{ data: Array<{ id: string; number: string; shortDescription: string }> }>("/changes", { params: { pageSize: 100 } })).data.data,
  });
  const save = useMutation({
    mutationFn: async (body: object) => api.post("/cab/meetings", body),
    onSuccess: async () => {
      notify("CAB meeting created");
      setTitle("");
      await queryClient.invalidateQueries({ queryKey: ["cab-meetings"] });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const decide = useMutation({
    mutationFn: async (input: { meetingId: string; changeId: string; decision: string }) => api.post(`/cab/meetings/${input.meetingId}/decisions`, { changeId: input.changeId, decision: input.decision, comments }),
    onSuccess: async () => {
      notify("CAB decision recorded");
      await queryClient.invalidateQueries({ queryKey: ["cab-meetings"] });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h4">CAB meetings</Typography>
        <Typography color="text.secondary">Agenda, risk summary, and an independent decision for each change.</Typography>
      </Box>
      {meetings.isError && <Alert severity="error">{errorMessage(meetings.error)}</Alert>}
      <Paper sx={{ p: 2, display: "grid", gridTemplateColumns: { md: "1fr 1fr 1fr auto" }, gap: 1, alignItems: "center" }}>
        <TextField size="small" label="Meeting title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextField size="small" type="datetime-local" label="Starts" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="datetime-local" label="Ends" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Button variant="contained" disabled={save.isPending || title.trim().length < 3 || !startsAt || !endsAt} onClick={() => save.mutate({ title, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), changeIds: changeId ? [changeId] : [] })}>Create</Button>
        <TextField select size="small" label="Agenda change" value={changeId} onChange={(event) => setChangeId(event.target.value)} sx={{ gridColumn: { md: "1 / -1" } }}>
          <MenuItem value="">None</MenuItem>
          {(changes.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.number} · {item.shortDescription}</MenuItem>)}
        </TextField>
      </Paper>
      {(meetings.data ?? []).map((meeting) => (
        <Paper key={meeting.id} sx={{ p: 2, display: "grid", gap: 1 }}>
          <Typography variant="h6">{meeting.number} · {meeting.title}</Typography>
          <Typography variant="body2" color="text.secondary">{formatDateTime(meeting.startsAt)} – {formatDateTime(meeting.endsAt)} · {pretty(meeting.status)} · {meeting.members.length} members</Typography>
          {meeting.agenda.length === 0 && <Typography variant="body2">No changes on the agenda.</Typography>}
          {meeting.agenda.map((item) => (
            <Box key={item.id} sx={{ display: "grid", gap: 0.5, borderTop: 1, borderColor: "divider", pt: 1 }}>
              <Typography variant="body2">
                <RouterLink to={`/changes/${item.change.id}`}>{item.change.number}</RouterLink> · {item.change.shortDescription} · risk {pretty(item.change.riskLevel)} · {pretty(item.change.state)}
              </Typography>
              <Typography variant="caption">Decision: {pretty(item.decision)} {item.comments ? `· ${item.comments}` : ""}</Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {["APPROVE", "REJECT", "DEFER", "MORE_INFO"].map((decision) => (
                  <Button key={decision} size="small" disabled={decide.isPending} onClick={() => decide.mutate({ meetingId: meeting.id, changeId: item.changeId, decision })}>{pretty(decision)}</Button>
                ))}
              </Box>
            </Box>
          ))}
          <TextField size="small" label="Decision comments" value={comments} onChange={(event) => setComments(event.target.value)} />
        </Paper>
      ))}
    </Box>
  );
}
