import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { useNotify } from "../../../app/notify";
import { api, errorMessage } from "../../../shared/services/api";
import { changeFormSchema, type ChangeFormValues } from "../changeSchema";

export function ChangeFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const [dirty, setDirty] = useState(false);
  const existing = useQuery({
    queryKey: ["change-form", id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<{ data: ChangeFormValues & { version: number } }>(`/changes/${id}`)).data.data,
  });
  const form = useForm<ChangeFormValues>({
    resolver: zodResolver(changeFormSchema),
    defaultValues: { shortDescription: "", description: "", type: "NORMAL" },
  });
  useEffect(() => {
    if (existing.data) form.reset(existing.data);
  }, [existing.data, form]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = useMutation({
    mutationFn: async (values: ChangeFormValues) => {
      const payload = Object.fromEntries(
        Object.entries(values)
          .filter(([, value]) => value !== "" && value != null)
          .map(([key, value]) => [key, key === "plannedStart" || key === "plannedEnd" ? new Date(String(value)).toISOString() : value]),
      );
      if (id && existing.data) {
        return api.patch(`/changes/${id}`, { ...payload, version: existing.data.version });
      }
      return api.post("/changes", payload);
    },
    onSuccess: (response) => {
      setDirty(false);
      notify(id ? "Change saved" : "Change created");
      const created = response.data?.data?.id as string | undefined;
      navigate(created ? `/changes/${created}` : `/changes/${id}`);
    },
    onError: (error) => notify(errorMessage(error), "error"),
  });

  return (
    <Paper sx={{ p: 3, display: "grid", gap: 2, maxWidth: 960 }}>
      <Box>
        <Typography variant="h4">{id ? "Edit change" : "Add change"}</Typography>
        <Typography color="text.secondary">The change number is assigned by the server when the record is created.</Typography>
      </Box>
      {existing.isError && <Alert severity="error">{errorMessage(existing.error)}</Alert>}
      <Box component="form" onChange={() => setDirty(true)} onSubmit={form.handleSubmit((values) => save.mutate(values))} sx={{ display: "grid", gridTemplateColumns: { md: "1fr 1fr" }, gap: 2 }}>
        <TextField label="Short description" {...form.register("shortDescription")} error={Boolean(form.formState.errors.shortDescription)} helperText={form.formState.errors.shortDescription?.message} />
        <TextField select label="Type" value={form.watch("type")} onChange={(event) => form.setValue("type", event.target.value as ChangeFormValues["type"], { shouldValidate: true })}>
          <MenuItem value="STANDARD">Standard</MenuItem>
          <MenuItem value="NORMAL">Normal</MenuItem>
          <MenuItem value="EMERGENCY">Emergency</MenuItem>
        </TextField>
        <TextField sx={{ gridColumn: "1 / -1" }} multiline minRows={4} label="Detailed description" {...form.register("description")} error={Boolean(form.formState.errors.description)} helperText={form.formState.errors.description?.message} />
        <TextField label="Business justification" {...form.register("businessJustification")} />
        <TextField label="Emergency justification" {...form.register("emergencyJustification")} error={Boolean(form.formState.errors.emergencyJustification)} helperText={form.formState.errors.emergencyJustification?.message} />
        <TextField select label="Business impact" value={form.watch("businessImpact") ?? ""} onChange={(event) => form.setValue("businessImpact", event.target.value)}>
          {["", "VERY_HIGH", "HIGH", "MEDIUM", "LOW", "VERY_LOW"].map((value) => <MenuItem key={value || "none"} value={value}>{value || "Unset"}</MenuItem>)}
        </TextField>
        <TextField select label="Probability" value={form.watch("probability") ?? ""} onChange={(event) => form.setValue("probability", event.target.value)}>
          {["", "HIGH", "MEDIUM", "LOW"].map((value) => <MenuItem key={value || "none"} value={value}>{value || "Unset"}</MenuItem>)}
        </TextField>
        <TextField type="datetime-local" label="Planned start" slotProps={{ inputLabel: { shrink: true } }} {...form.register("plannedStart")} />
        <TextField type="datetime-local" label="Planned end" slotProps={{ inputLabel: { shrink: true } }} {...form.register("plannedEnd")} error={Boolean(form.formState.errors.plannedEnd)} helperText={form.formState.errors.plannedEnd?.message} />
        <TextField sx={{ gridColumn: "1 / -1" }} multiline minRows={3} label="Backout plan" {...form.register("backoutPlan")} />
        <Box sx={{ gridColumn: "1 / -1", display: "flex", gap: 1 }}>
          <Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          <Button onClick={() => navigate(id ? `/changes/${id}` : "/changes")}>Cancel</Button>
        </Box>
      </Box>
    </Paper>
  );
}
