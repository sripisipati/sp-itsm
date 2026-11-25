import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { UserLookup } from "../../../shared/components/UserLookup";
import { api, errorMessage } from "../../../shared/services/api";
import { useNotify } from "../../../app/notify";
import { formatDateTime } from "../../../shared/utilities/format";
import { impactLabels, impacts, label, priorityLabels, severities, severityLabels, statusLabels } from "../../../shared/utilities/labels";
import { ActivityTimeline } from "../components/ActivityTimeline";
import type { IncidentDetail } from "../types";
import { emptyIncidentForm, incidentSchema, type IncidentFormValues } from "../validation/incidentSchema";

interface Named { id: string; name: string; parentId?: string | null }
interface Group { id: string; name: string; members: Array<{ id: string; name: string }> }

function nullable(value?: string) {
  return value ? value : null;
}

export function IncidentFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState("");
  const [status, setStatus] = useState("NEW");
  const form = useForm<IncidentFormValues>({ resolver: zodResolver(incidentSchema), defaultValues: emptyIncidentForm });
  const allowNavigation = useRef(false);
  const blocker = useBlocker(() => form.formState.isDirty && !allowNavigation.current);
  const incident = useQuery({
    queryKey: ["incident", id],
    enabled: editing,
    queryFn: async () => (await api.get<{ data: IncidentDetail }>(`/incidents/${id}`)).data.data,
  });
  const categories = useQuery({ queryKey: ["categories"], queryFn: async () => (await api.get<{ data: Named[] }>("/categories")).data.data });
  const groups = useQuery({ queryKey: ["groups"], queryFn: async () => (await api.get<{ data: Group[] }>("/assignment-groups")).data.data });
  const items = useQuery({ queryKey: ["cis"], queryFn: async () => (await api.get<{ data: Named[] }>("/configuration-items")).data.data });
  const services = useQuery({ queryKey: ["services"], queryFn: async () => (await api.get<{ data: Named[] }>("/business-services")).data.data });
  const codes = useQuery({ queryKey: ["resolution-codes"], queryFn: async () => (await api.get<{ data: Array<{ code: string; label: string }> }>("/configuration/resolution-codes")).data.data });
  const impact = form.watch("impact");
  const urgency = form.watch("urgency");
  const priority = useQuery({
    queryKey: ["priority", impact, urgency],
    queryFn: async () => (await api.get<{ data: { priority: string; explanation: string } }>("/configuration/priority", { params: { impact, urgency } })).data.data,
  });

  useEffect(() => {
    const record = incident.data;
    if (!record) return;
    form.reset({
      ...emptyIncidentForm,
      shortDescription: record.shortDescription,
      description: record.description,
      categoryId: record.categoryId ?? "",
      subcategoryId: record.subcategoryId ?? "",
      callerId: record.callerId ?? "",
      contactInformation: record.contactInformation ?? "",
      configurationItemId: record.configurationItemId ?? "",
      businessServiceId: record.businessServiceId ?? "",
      affectedLocation: record.affectedLocation ?? "",
      impact: record.impact as IncidentFormValues["impact"],
      urgency: record.urgency as IncidentFormValues["urgency"],
      severity: record.severity as IncidentFormValues["severity"],
      impactedUsers: record.impactedUsers,
      assignmentGroupId: record.assignmentGroupId ?? "",
      assignedToId: record.assignedToId ?? "",
      resolutionCode: record.resolutionCode ?? "",
      resolutionNotes: record.resolutionNotes ?? "",
    });
    setStatus(record.status);
  }, [form, incident.data]);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!form.formState.isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [form.formState.isDirty]);

  const groupId = form.watch("assignmentGroupId");
  const members = groups.data?.find((group) => group.id === groupId)?.members ?? [];
  const parents = categories.data?.filter((category) => !category.parentId) ?? [];
  const children = categories.data?.filter((category) => category.parentId === form.watch("categoryId")) ?? [];

  const save = useMutation({
    mutationFn: async (values: IncidentFormValues) => {
      const body = {
        shortDescription: values.shortDescription,
        description: values.description,
        categoryId: nullable(values.categoryId),
        subcategoryId: nullable(values.subcategoryId),
        callerId: nullable(values.callerId),
        contactInformation: values.contactInformation || null,
        configurationItemId: nullable(values.configurationItemId),
        businessServiceId: nullable(values.businessServiceId),
        affectedLocation: values.affectedLocation || null,
        impact: values.impact,
        urgency: values.urgency,
        severity: values.severity,
        impactedUsers: Number(values.impactedUsers),
        assignmentGroupId: nullable(values.assignmentGroupId),
        assignedToId: nullable(values.assignedToId),
        resolutionCode: values.resolutionCode || null,
        resolutionNotes: values.resolutionNotes || null,
        initialComment: values.initialComment || undefined,
        initialWorkNote: values.initialWorkNote || undefined,
      };
      if (!id) return (await api.post<{ data: IncidentDetail }>("/incidents", body)).data.data;
      return (await api.patch<{ data: IncidentDetail }>(`/incidents/${id}`, { ...body, version: incident.data?.version, status: status === incident.data?.status ? undefined : status })).data.data;
    },
    onSuccess: async (record) => {
      form.reset(form.getValues());
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
      await queryClient.invalidateQueries({ queryKey: ["incident", record.id] });
      notify("Incident saved.");
      return record;
    },
    onError: (error) => setSubmitError(errorMessage(error)),
  });

  async function persist(closeAfter: boolean) {
    setSubmitError("");
    const valid = await form.trigger();
    if (!valid) return;
    const record = await save.mutateAsync(form.getValues());
    allowNavigation.current = true;
    form.reset(form.getValues());
    if (closeAfter) navigate("/incidents");
    else if (!id) navigate(`/incidents/${record.id}/edit`, { replace: true });
  }

  return (
    <Box component="form" sx={{ display: "grid", gap: 2 }} onSubmit={(event) => { event.preventDefault(); void persist(false); }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4">{editing ? "Edit Incident" : "Create Incident"}</Typography>
          <Typography color="text.secondary">Ticket numbers and audit fields are assigned by the service.</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button type="submit" variant="outlined" disabled={save.isPending}>Save</Button>
          <Button variant="contained" disabled={save.isPending} onClick={() => void persist(false)}>Submit</Button>
          <Button variant="contained" color="secondary" disabled={save.isPending} onClick={() => void persist(true)}>Save & Close</Button>
          <Button onClick={() => navigate("/incidents")}>Cancel</Button>
          {incident.data?.permissions.canResolve && (
            <Button color="success" variant="outlined" onClick={() => setStatus("RESOLVED")}>Resolve</Button>
          )}
        </Box>
      </Box>
      {submitError && <Alert severity="error">{submitError}</Alert>}
      {incident.isError && <Alert severity="error">{errorMessage(incident.error)}</Alert>}
      <Section title="Incident information">
        <TextField label="Ticket Number" value={incident.data?.ticketNumber ?? "Assigned when you save"} slotProps={{ input: { readOnly: true } }} />
        <TextField label="Short Description" required {...form.register("shortDescription")} error={Boolean(form.formState.errors.shortDescription)} helperText={form.formState.errors.shortDescription?.message} />
        <TextField label="Detailed Description" required multiline minRows={4} {...form.register("description")} error={Boolean(form.formState.errors.description)} helperText={form.formState.errors.description?.message} sx={{ gridColumn: { md: "1 / -1" } }} />
        <TextField select label="Category" value={form.watch("categoryId") ?? ""} onChange={(event) => { form.setValue("categoryId", event.target.value, { shouldDirty: true }); form.setValue("subcategoryId", ""); }}>
          <MenuItem value="">None</MenuItem>
          {parents.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}
        </TextField>
        <TextField select label="Subcategory" value={form.watch("subcategoryId") ?? ""} onChange={(event) => form.setValue("subcategoryId", event.target.value, { shouldDirty: true })}>
          <MenuItem value="">None</MenuItem>
          {children.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}
        </TextField>
        <UserLookup label="Caller / Requested By" value={form.watch("callerId") ?? ""} initial={incident.data?.caller} onChange={(value) => form.setValue("callerId", value, { shouldDirty: true })} />
        <TextField label="Contact Information" {...form.register("contactInformation")} />
        <TextField select label="Configuration Item" value={form.watch("configurationItemId") ?? ""} onChange={(event) => form.setValue("configurationItemId", event.target.value, { shouldDirty: true })}>
          <MenuItem value="">None</MenuItem>
          {items.data?.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
        </TextField>
        <TextField select label="Business Service" value={form.watch("businessServiceId") ?? ""} onChange={(event) => form.setValue("businessServiceId", event.target.value, { shouldDirty: true })}>
          <MenuItem value="">None</MenuItem>
          {services.data?.map((service) => <MenuItem key={service.id} value={service.id}>{service.name}</MenuItem>)}
        </TextField>
        <TextField label="Affected Location" {...form.register("affectedLocation")} />
      </Section>
      <Section title="Impact and classification">
        <TextField select label="Business Impact" value={impact} onChange={(event) => form.setValue("impact", event.target.value as IncidentFormValues["impact"], { shouldDirty: true })}>
          {impacts.map((value) => <MenuItem key={value} value={value}>{impactLabels[value]}</MenuItem>)}
        </TextField>
        <TextField select label="Urgency" value={urgency} onChange={(event) => form.setValue("urgency", event.target.value as IncidentFormValues["urgency"], { shouldDirty: true })}>
          {impacts.map((value) => <MenuItem key={value} value={value}>{impactLabels[value]}</MenuItem>)}
        </TextField>
        <TextField select label="Severity" value={form.watch("severity")} onChange={(event) => form.setValue("severity", event.target.value as IncidentFormValues["severity"], { shouldDirty: true })}>
          {severities.map((value) => <MenuItem key={value} value={value}>{severityLabels[value]}</MenuItem>)}
        </TextField>
        <TextField label="Priority" value={priority.data ? label(priorityLabels, priority.data.priority) : "Calculating..."} slotProps={{ input: { readOnly: true } }} helperText={priority.data?.explanation ?? "Priority is calculated from the configured matrix."} />
        <TextField label="Impacted Users" type="number" {...form.register("impactedUsers")} />
      </Section>
      <Section title="Assignment">
        <TextField select label="Assignment Group" value={groupId ?? ""} onChange={(event) => { form.setValue("assignmentGroupId", event.target.value, { shouldDirty: true }); form.setValue("assignedToId", ""); }}>
          <MenuItem value="">None</MenuItem>
          {groups.data?.map((group) => <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>)}
        </TextField>
        <TextField select label="Assigned To" value={form.watch("assignedToId") ?? ""} onChange={(event) => form.setValue("assignedToId", event.target.value, { shouldDirty: true })} helperText={form.formState.errors.assignedToId?.message}>
          <MenuItem value="">Unassigned</MenuItem>
          {members.map((member) => <MenuItem key={member.id} value={member.id}>{member.name}</MenuItem>)}
        </TextField>
        <TextField label="Assigned On" value={formatDateTime(incident.data?.assignedOn)} slotProps={{ input: { readOnly: true } }} />
        <TextField select label="Status" value={editing ? status : (form.watch("assignedToId") ? "ASSIGNED" : "NEW")} onChange={(event) => setStatus(event.target.value)} disabled={!editing}>
          {(editing ? [incident.data?.status, ...(incident.data?.allowedTransitions ?? [])].filter(Boolean) : [form.watch("assignedToId") ? "ASSIGNED" : "NEW"]).map((value) => (
            <MenuItem key={value} value={value}>{label(statusLabels, value)}</MenuItem>
          ))}
        </TextField>
      </Section>
      <Section title="Resolution">
        <TextField select label="Resolution Code" value={form.watch("resolutionCode") ?? ""} onChange={(event) => form.setValue("resolutionCode", event.target.value, { shouldDirty: true })}>
          <MenuItem value="">None</MenuItem>
          {codes.data?.map((code) => <MenuItem key={code.code} value={code.code}>{code.label}</MenuItem>)}
        </TextField>
        <TextField label="Resolution Notes" multiline minRows={3} {...form.register("resolutionNotes")} helperText={status === "RESOLVED" ? "Required when resolving." : ""} />
        <TextField label="Resolved By" value={incident.data?.resolvedBy?.name ?? "—"} slotProps={{ input: { readOnly: true } }} />
        <TextField label="Resolved On" value={formatDateTime(incident.data?.resolvedOn)} slotProps={{ input: { readOnly: true } }} />
      </Section>
      <Section title="Notes and activity">
        {!editing && <TextField label="Additional Comment" multiline minRows={2} {...form.register("initialComment")} />}
        {!editing && <TextField label="Work Note" multiline minRows={2} {...form.register("initialWorkNote")} helperText="Internal notes are hidden from requesters." />}
        {editing && <Box sx={{ gridColumn: { md: "1 / -1" } }}><ActivityTimeline items={incident.data?.activity ?? []} /></Box>}
      </Section>
      <Section title="Attachments">
        <Typography color="text.secondary">{editing ? "Upload files from the incident details page after the record is saved." : "Save the incident before uploading attachments."}</Typography>
      </Section>
      <Section title="Audit">
        <TextField label="Created By" value={incident.data?.createdBy?.name ?? "—"} slotProps={{ input: { readOnly: true } }} />
        <TextField label="Created On" value={formatDateTime(incident.data?.createdAt)} slotProps={{ input: { readOnly: true } }} />
        <TextField label="Updated By" value={incident.data?.updatedBy?.name ?? "—"} slotProps={{ input: { readOnly: true } }} />
        <TextField label="Updated On" value={formatDateTime(incident.data?.updatedAt)} slotProps={{ input: { readOnly: true } }} />
      </Section>
      <Dialog open={blocker.state === "blocked"}>
        <DialogTitle>Leave this incident?</DialogTitle>
        <DialogContent>Your unsaved changes will be lost.</DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.reset?.()}>Stay</Button>
          <Button color="error" onClick={() => blocker.proceed?.()}>Leave</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>{title}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>{children}</Box>
    </Paper>
  );
}
