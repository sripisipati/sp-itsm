import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNotify } from "../../../app/notify";
import { api, errorMessage } from "../../../shared/services/api";
import { pretty } from "../options";

interface Policy {
  id: string;
  name: string;
  changeType: string;
  mode: string;
  isActive: boolean;
  allowSelfApproval: boolean;
  steps: Array<{ id: string; sequence: number; approvalType: string; requiredRole: string; deadlineHours: number | null }>;
}

const roles = ["TECHNICAL_APPROVER", "BUSINESS_APPROVER", "CAB_MEMBER", "CHANGE_MANAGER", "CHANGE_OWNER", "ITSM_ADMINISTRATOR"];
const approvalTypes = ["TECHNICAL", "BUSINESS", "APPLICATION_OWNER", "INFRASTRUCTURE", "SECURITY", "CAB", "EMERGENCY"];

export function ChangePoliciesPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [changeType, setChangeType] = useState("NORMAL");
  const [mode, setMode] = useState("SEQUENTIAL");
  const policies = useQuery({
    queryKey: ["approval-policies"],
    queryFn: async () => (await api.get<{ data: Policy[] }>("/approval-policies")).data.data,
  });
  const create = useMutation({
    mutationFn: async () => api.post("/approval-policies", { name, changeType, mode }),
    onSuccess: async () => {
      notify("Approval policy created");
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["approval-policies"] });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });
  const addStep = useMutation({
    mutationFn: async (input: { id: string; sequence: number; approvalType: string; requiredRole: string }) => api.post(`/approval-policies/${input.id}/steps`, input),
    onSuccess: async () => {
      notify("Approval step added");
      await queryClient.invalidateQueries({ queryKey: ["approval-policies"] });
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h4">Approval policies</Typography>
        <Typography color="text.secondary">Sequential and parallel steps are stored as policy rows. The workflow reads the active policy for the change type and risk.</Typography>
      </Box>
      {policies.isError && <Alert severity="error">{errorMessage(policies.error)}</Alert>}
      <Paper sx={{ p: 2, display: "grid", gridTemplateColumns: { md: "2fr 1fr 1fr auto" }, gap: 1 }}>
        <TextField size="small" label="Policy name" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField select size="small" label="Type" value={changeType} onChange={(event) => setChangeType(event.target.value)}>
          {["STANDARD", "NORMAL", "EMERGENCY"].map((type) => <MenuItem key={type} value={type}>{pretty(type)}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Mode" value={mode} onChange={(event) => setMode(event.target.value)}>
          <MenuItem value="SEQUENTIAL">Sequential</MenuItem>
          <MenuItem value="PARALLEL">Parallel</MenuItem>
        </TextField>
        <Button variant="contained" disabled={create.isPending || name.trim().length < 3} onClick={() => create.mutate()}>Add policy</Button>
      </Paper>
      {(policies.data ?? []).map((policy) => (
        <Paper key={policy.id} sx={{ p: 2, display: "grid", gap: 1 }}>
          <Typography variant="h6">{policy.name}</Typography>
          <Typography variant="body2">{pretty(policy.changeType)} · {pretty(policy.mode)} · {policy.isActive ? "Active" : "Inactive"} · self-approval {policy.allowSelfApproval ? "allowed" : "blocked"}</Typography>
          {policy.steps.map((step) => (
            <Typography key={step.id} variant="body2">Step {step.sequence}: {pretty(step.approvalType)} · {pretty(step.requiredRole)} {step.deadlineHours ? `· ${step.deadlineHours}h` : ""}</Typography>
          ))}
          <Button size="small" disabled={addStep.isPending} onClick={() => addStep.mutate({
            id: policy.id,
            sequence: policy.steps.length + 1,
            approvalType: approvalTypes[policy.steps.length % approvalTypes.length],
            requiredRole: roles[policy.steps.length % roles.length],
          })}>Add next step</Button>
        </Paper>
      ))}
    </Box>
  );
}
