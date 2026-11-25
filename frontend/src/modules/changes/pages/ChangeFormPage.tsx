import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useBlocker, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useNotify } from "../../../app/notify";
import { UserLookup, type UserOption } from "../../../shared/components/UserLookup";
import { api, errorMessage } from "../../../shared/services/api";
import { formatDateTime } from "../../../shared/utilities/format";
import { RecordLookup } from "../components/RecordLookup";
import { changeFormSchema, emptyChangeForm, toChangePayload, type ChangeFormValues } from "../changeSchema";
import { changeTypes, impactLevels, pretty, probabilities, urgencies } from "../options";

interface Named { id: string; name: string; parentId?: string | null }
interface Person { id: string; name?: string | null; firstName?: string | null; lastName?: string | null }
interface ChangeRecord extends ChangeFormValues {
  id: string;
  number: string;
  version: number;
  requestedBy: Person | null;
  requestedFor: Person | null;
  changeOwner: Person | null;
  implementationLead: Person | null;
  changeCoordinator: Person | null;
  assignedTo: Person | null;
  rollbackOwner: Person | null;
  relatedIncident: { id: string; ticketNumber: string; shortDescription: string } | null;
  relatedProblem: { id: string; number: string; shortDescription: string } | null;
  affectedCis: Array<{ configurationItemId: string }>;
  affectedServices: Array<{ businessServiceId: string }>;
  createdBy: Person | null;
  updatedBy: Person | null;
  createdAt: string;
  updatedAt: string;
  riskLevel: string | null;
  priority: string | null;
  risk: { summary?: string } | null;
}

interface Preview {
  level: string | null;
  score: number | null;
  summary: string;
  priority: string | null;
  rollbackRequired: boolean;
  pirRequired: boolean;
  factors?: Array<{ factor: string; input: string; contribution: number }>;
}

function toInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function userOption(person: Person | null | undefined): UserOption | null {
  if (!person) return null;
  const name = person.name || [person.firstName, person.lastName].filter(Boolean).join(" ");
  return name ? { id: person.id, name } : null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ gridColumn: "1 / -1", display: "grid", gap: 1.5 }}>
      <Typography variant="h6">{title}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { md: "1fr 1fr" }, gap: 2 }}>{children}</Box>
    </Box>
  );
}

export function ChangeFormPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const allowNavigation = useRef(false);
  const form = useForm<ChangeFormValues>({
    resolver: zodResolver(changeFormSchema),
    defaultValues: { ...emptyChangeForm, relatedIncidentId: search.get("incidentId") ?? "", relatedProblemId: search.get("problemId") ?? "" },
  });
  const blocker = useBlocker(() => form.formState.isDirty && !allowNavigation.current);
  const existing = useQuery({
    queryKey: ["change-form", id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<{ data: ChangeRecord }>(`/changes/${id}`)).data.data,
  });
  const categories = useQuery({ queryKey: ["change-categories"], queryFn: async () => (await api.get<{ data: Named[] }>("/change-categories")).data.data });
  const groups = useQuery({ queryKey: ["groups"], queryFn: async () => (await api.get<{ data: Named[] }>("/assignment-groups")).data.data });
  const items = useQuery({ queryKey: ["cis"], queryFn: async () => (await api.get<{ data: Named[] }>("/configuration-items")).data.data });
  const services = useQuery({ queryKey: ["services"], queryFn: async () => (await api.get<{ data: Named[] }>("/business-services")).data.data });
  const templates = useQuery({ queryKey: ["change-templates"], queryFn: async () => (await api.get<{ data: Array<{ id: string; name: string }> }>("/change-templates")).data.data });
  const windows = useQuery({
    queryKey: ["schedule-catalog"],
    queryFn: async () => (await api.get<{ data: { maintenanceWindows: Array<{ id: string; name: string; startAt: string; endAt: string }> } }>("/changes/schedule-catalog")).data.data,
  });

  useEffect(() => {
    const record = existing.data;
    if (!record) return;
    form.reset({
      ...emptyChangeForm,
      shortDescription: record.shortDescription,
      description: record.description,
      type: record.type,
      templateId: record.templateId ?? "",
      categoryId: record.categoryId ?? "",
      subcategoryId: record.subcategoryId ?? "",
      requestedById: record.requestedById ?? "",
      requestedForId: record.requestedForId ?? "",
      businessJustification: record.businessJustification ?? "",
      businessServiceId: record.businessServiceId ?? "",
      configurationItemId: record.configurationItemId ?? "",
      relatedIncidentId: record.relatedIncidentId ?? "",
      relatedProblemId: record.relatedProblemId ?? "",
      emergencyJustification: record.emergencyJustification ?? "",
      businessImpact: record.businessImpact ?? "",
      technicalImpact: record.technicalImpact ?? "",
      urgency: record.urgency ?? "",
      probability: record.probability ?? "",
      impactedUsers: record.impactedUsers ? String(record.impactedUsers) : "",
      downtimeRequired: Boolean(record.downtimeRequired),
      estimatedDowntimeMinutes: record.estimatedDowntimeMinutes ? String(record.estimatedDowntimeMinutes) : "",
      riskAssessmentNarrative: record.riskAssessmentNarrative ?? "",
      impactAnalysis: record.impactAnalysis ?? "",
      affectedCiIds: record.affectedCis?.map((item) => item.configurationItemId) ?? [],
      affectedServiceIds: record.affectedServices?.map((item) => item.businessServiceId) ?? [],
      plannedStart: toInput(record.plannedStart),
      plannedEnd: toInput(record.plannedEnd),
      actualStart: toInput(record.actualStart),
      actualEnd: toInput(record.actualEnd),
      maintenanceWindowId: record.maintenanceWindowId ?? "",
      assignmentGroupId: record.assignmentGroupId ?? "",
      implementationGroupId: record.implementationGroupId ?? "",
      changeOwnerId: record.changeOwnerId ?? "",
      implementationLeadId: record.implementationLeadId ?? "",
      changeCoordinatorId: record.changeCoordinatorId ?? "",
      assignedToId: record.assignedToId ?? "",
      backoutRequired: Boolean(record.backoutRequired),
      backoutPlan: record.backoutPlan ?? "",
      backoutTriggerConditions: record.backoutTriggerConditions ?? "",
      rollbackSteps: record.rollbackSteps ?? "",
      rollbackDurationMinutes: record.rollbackDurationMinutes ? String(record.rollbackDurationMinutes) : "",
      rollbackOwnerId: record.rollbackOwnerId ?? "",
      testPlan: record.testPlan ?? "",
      implementationStatus: record.implementationStatus ?? "",
      implementationSummary: record.implementationSummary ?? "",
      implementationOutcome: record.implementationOutcome ?? "",
      serviceImpactSummary: record.serviceImpactSummary ?? "",
      issuesEncountered: record.issuesEncountered ?? "",
      rollbackExecuted: Boolean(record.rollbackExecuted),
      resolutionDetails: record.resolutionDetails ?? "",
    });
  }, [existing.data, form]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!form.formState.isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [form.formState.isDirty]);

  const values = form.watch();
  const preview = useQuery({
    queryKey: ["change-preview", values.type, values.businessImpact, values.technicalImpact, values.urgency, values.probability, values.downtimeRequired, values.impactedUsers],
    queryFn: async () => (await api.post<{ data: Preview }>("/changes/preview-classification", {
      type: values.type,
      businessImpact: values.businessImpact || undefined,
      technicalImpact: values.technicalImpact || undefined,
      urgency: values.urgency || undefined,
      probability: values.probability || undefined,
      downtimeRequired: Boolean(values.downtimeRequired),
      impactedUsers: values.impactedUsers ? Number(values.impactedUsers) : 0,
    })).data.data,
  });
  const conflicts = useQuery({
    queryKey: ["change-conflicts", values.plannedStart, values.plannedEnd, values.configurationItemId, values.businessServiceId, values.affectedCiIds, values.affectedServiceIds, id],
    enabled: Boolean(values.plannedStart && values.plannedEnd),
    queryFn: async () => (await api.get<{ data: { conflicts: Array<{ message: string }>; warnings: Array<{ message: string }> } }>("/changes/conflicts", {
      params: {
        plannedStart: new Date(values.plannedStart!).toISOString(),
        plannedEnd: new Date(values.plannedEnd!).toISOString(),
        configurationItemId: values.configurationItemId || undefined,
        businessServiceId: values.businessServiceId || undefined,
        affectedCiIds: values.affectedCiIds?.join(",") || undefined,
        affectedServiceIds: values.affectedServiceIds?.join(",") || undefined,
        excludeChangeId: id,
      },
    })).data.data,
  });

  const parents = (categories.data ?? []).filter((item) => !item.parentId);
  const subcategories = (categories.data ?? []).filter((item) => item.parentId && item.parentId === values.categoryId);

  async function save(next: ChangeFormValues) {
    try {
      const payload = toChangePayload(next, existing.data?.version);
      const response = id
        ? await api.patch<{ data: { id: string } }>(`/changes/${id}`, payload)
        : await api.post<{ data: { id: string } }>("/changes", payload);
      allowNavigation.current = true;
      notify(id ? "Change saved" : "Change created");
      navigate(`/changes/${response.data.data.id}`);
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  }

  const field = (name: keyof ChangeFormValues, label: string, props?: { multiline?: boolean; type?: string; select?: boolean; options?: readonly string[] }) => (
    <TextField
      label={label}
      type={props?.type}
      multiline={props?.multiline}
      minRows={props?.multiline ? 3 : undefined}
      select={props?.select}
      error={Boolean(form.formState.errors[name])}
      helperText={form.formState.errors[name]?.message as string | undefined}
      slotProps={props?.type === "datetime-local" ? { inputLabel: { shrink: true } } : undefined}
      {...(props?.select
        ? { value: form.watch(name) ?? "", onChange: (event) => form.setValue(name, event.target.value as never, { shouldDirty: true, shouldValidate: true }) }
        : form.register(name))}
    >
      {props?.select && [<MenuItem key="unset" value="">Unset</MenuItem>, ...(props.options ?? []).map((option) => <MenuItem key={option} value={option}>{pretty(option)}</MenuItem>)]}
    </TextField>
  );

  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h4">{id ? "Edit change" : "Add change"}</Typography>
        <Typography color="text.secondary">The change number is assigned by the server when the record is created. Times are stored in UTC and shown in the configured timezone.</Typography>
      </Box>
      {existing.isError && <Alert severity="error">{errorMessage(existing.error)}</Alert>}
      {id && existing.data && (
        <Alert severity="info">
          {existing.data.number} · Created {formatDateTime(existing.data.createdAt)} by {userOption(existing.data.createdBy)?.name ?? "—"} · Updated {formatDateTime(existing.data.updatedAt)} by {userOption(existing.data.updatedBy)?.name ?? "—"}
        </Alert>
      )}
      <Box component="form" onSubmit={form.handleSubmit(save)} sx={{ display: "grid", gap: 3 }}>
        <Section title="Change information">
          <TextField label="Change number" value={existing.data?.number ?? "Assigned on save"} slotProps={{ input: { readOnly: true } }} />
          {field("shortDescription", "Short description")}
          <TextField select label="Type" value={form.watch("type")} onChange={(event) => form.setValue("type", event.target.value as ChangeFormValues["type"], { shouldDirty: true, shouldValidate: true })}>
            {changeTypes.map((type) => <MenuItem key={type} value={type}>{pretty(type)}</MenuItem>)}
          </TextField>
          <TextField sx={{ gridColumn: { md: "1 / -1" } }} multiline minRows={4} label="Detailed description" {...form.register("description")} error={Boolean(form.formState.errors.description)} helperText={form.formState.errors.description?.message} />
          <TextField select label="Standard change template" value={form.watch("templateId") ?? ""} onChange={(event) => form.setValue("templateId", event.target.value, { shouldDirty: true })}>
            <MenuItem value="">None</MenuItem>
            {(templates.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <TextField select label="Category" value={form.watch("categoryId") ?? ""} onChange={(event) => { form.setValue("categoryId", event.target.value, { shouldDirty: true }); form.setValue("subcategoryId", ""); }}>
            <MenuItem value="">None</MenuItem>
            {parents.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <TextField select label="Subcategory" value={form.watch("subcategoryId") ?? ""} onChange={(event) => form.setValue("subcategoryId", event.target.value, { shouldDirty: true })}>
            <MenuItem value="">None</MenuItem>
            {subcategories.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <UserLookup label="Requested by" value={form.watch("requestedById") ?? ""} initial={userOption(existing.data?.requestedBy)} onChange={(value) => form.setValue("requestedById", value, { shouldDirty: true })} />
          <UserLookup label="Requested for" value={form.watch("requestedForId") ?? ""} initial={userOption(existing.data?.requestedFor)} onChange={(value) => form.setValue("requestedForId", value, { shouldDirty: true })} />
          {field("businessJustification", "Business justification", { multiline: true })}
          {field("emergencyJustification", "Emergency justification", { multiline: true })}
          <TextField select label="Business service" value={form.watch("businessServiceId") ?? ""} onChange={(event) => form.setValue("businessServiceId", event.target.value, { shouldDirty: true })}>
            <MenuItem value="">None</MenuItem>
            {(services.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <TextField select label="Configuration item" value={form.watch("configurationItemId") ?? ""} onChange={(event) => form.setValue("configurationItemId", event.target.value, { shouldDirty: true })}>
            <MenuItem value="">None</MenuItem>
            {(items.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <RecordLookup label="Related incident" resource="incidents" value={form.watch("relatedIncidentId") ?? ""} initialLabel={existing.data?.relatedIncident ? `${existing.data.relatedIncident.ticketNumber} · ${existing.data.relatedIncident.shortDescription}` : undefined} onChange={(value) => form.setValue("relatedIncidentId", value, { shouldDirty: true })} />
          <RecordLookup label="Related problem" resource="problems" value={form.watch("relatedProblemId") ?? ""} initialLabel={existing.data?.relatedProblem ? `${existing.data.relatedProblem.number} · ${existing.data.relatedProblem.shortDescription}` : undefined} onChange={(value) => form.setValue("relatedProblemId", value, { shouldDirty: true })} />
        </Section>

        <Section title="Risk and impact">
          {field("businessImpact", "Business impact", { select: true, options: impactLevels })}
          {field("technicalImpact", "Technical impact", { select: true, options: impactLevels })}
          {field("urgency", "Urgency", { select: true, options: urgencies })}
          {field("probability", "Probability", { select: true, options: probabilities })}
          {field("impactedUsers", "Impacted users")}
          {field("estimatedDowntimeMinutes", "Estimated downtime (minutes)")}
          <FormControlLabel control={<Checkbox checked={Boolean(form.watch("downtimeRequired"))} onChange={(_event, checked) => form.setValue("downtimeRequired", checked, { shouldDirty: true })} />} label="Downtime required" />
          {field("riskAssessmentNarrative", "Risk assessment", { multiline: true })}
          {field("impactAnalysis", "Impact analysis", { multiline: true })}
          <TextField select label="Affected configuration items" value={form.watch("affectedCiIds") ?? []} onChange={(event) => form.setValue("affectedCiIds", event.target.value as unknown as string[], { shouldDirty: true })} slotProps={{ select: { multiple: true } }}>
            {(items.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <TextField select label="Affected services" value={form.watch("affectedServiceIds") ?? []} onChange={(event) => form.setValue("affectedServiceIds", event.target.value as unknown as string[], { shouldDirty: true })} slotProps={{ select: { multiple: true } }}>
            {(services.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <Alert sx={{ gridColumn: { md: "1 / -1" } }} severity={preview.data?.level === "VERY_HIGH" || preview.data?.level === "HIGH" ? "warning" : "info"}>
            Risk {pretty(preview.data?.level)} · score {preview.data?.score ?? "—"} · priority {pretty(preview.data?.priority)}. {preview.data?.summary}
            {preview.data?.rollbackRequired ? " A rollback plan is required for this type and risk." : ""}
            {preview.data?.pirRequired ? " A post-implementation review is required." : ""}
          </Alert>
        </Section>

        <Section title="Planning and scheduling">
          {field("plannedStart", "Planned start", { type: "datetime-local" })}
          {field("plannedEnd", "Planned end", { type: "datetime-local" })}
          {field("actualStart", "Actual start", { type: "datetime-local" })}
          {field("actualEnd", "Actual end", { type: "datetime-local" })}
          <TextField select label="Maintenance window" value={form.watch("maintenanceWindowId") ?? ""} onChange={(event) => form.setValue("maintenanceWindowId", event.target.value, { shouldDirty: true })}>
            <MenuItem value="">None</MenuItem>
            {(windows.data?.maintenanceWindows ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {formatDateTime(item.startAt)}</MenuItem>)}
          </TextField>
          <TextField select label="Assignment group" value={form.watch("assignmentGroupId") ?? ""} onChange={(event) => form.setValue("assignmentGroupId", event.target.value, { shouldDirty: true })}>
            <MenuItem value="">None</MenuItem>
            {(groups.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <TextField select label="Implementation group" value={form.watch("implementationGroupId") ?? ""} onChange={(event) => form.setValue("implementationGroupId", event.target.value, { shouldDirty: true })}>
            <MenuItem value="">None</MenuItem>
            {(groups.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </TextField>
          <UserLookup label="Change owner" value={form.watch("changeOwnerId") ?? ""} initial={userOption(existing.data?.changeOwner)} onChange={(value) => form.setValue("changeOwnerId", value, { shouldDirty: true })} />
          <UserLookup label="Implementation lead" value={form.watch("implementationLeadId") ?? ""} initial={userOption(existing.data?.implementationLead)} onChange={(value) => form.setValue("implementationLeadId", value, { shouldDirty: true })} />
          <UserLookup label="Change coordinator" value={form.watch("changeCoordinatorId") ?? ""} initial={userOption(existing.data?.changeCoordinator)} onChange={(value) => form.setValue("changeCoordinatorId", value, { shouldDirty: true })} />
          <UserLookup label="Assigned to" value={form.watch("assignedToId") ?? ""} initial={userOption(existing.data?.assignedTo)} onChange={(value) => form.setValue("assignedToId", value, { shouldDirty: true })} />
          {conflicts.data?.conflicts.map((item) => <Alert key={item.message} severity="error" sx={{ gridColumn: { md: "1 / -1" } }}>{item.message} Scheduling over this conflict requires an authorized justification.</Alert>)}
          {conflicts.data?.warnings.map((item) => <Alert key={item.message} severity="warning" sx={{ gridColumn: { md: "1 / -1" } }}>{item.message}</Alert>)}
          <Button sx={{ justifySelf: "start" }} onClick={() => navigate("/changes/calendar")}>Open calendar</Button>
        </Section>

        <Section title="Testing and validation">
          {field("testPlan", "Test plan", { multiline: true })}
          <Typography sx={{ gridColumn: { md: "1 / -1" } }} variant="body2" color="text.secondary">Individual test cases are added on the change details page after the record is saved.</Typography>
        </Section>

        <Section title="Backout and rollback">
          <FormControlLabel control={<Checkbox checked={Boolean(form.watch("backoutRequired"))} onChange={(_event, checked) => form.setValue("backoutRequired", checked, { shouldDirty: true })} />} label="Backout required" />
          <FormControlLabel control={<Checkbox checked={Boolean(form.watch("rollbackExecuted"))} onChange={(_event, checked) => form.setValue("rollbackExecuted", checked, { shouldDirty: true })} />} label="Rollback executed" />
          {field("backoutPlan", "Backout plan", { multiline: true })}
          {field("backoutTriggerConditions", "Rollback trigger conditions", { multiline: true })}
          {field("rollbackSteps", "Rollback steps", { multiline: true })}
          {field("rollbackDurationMinutes", "Estimated rollback duration (minutes)")}
          <UserLookup label="Rollback owner" value={form.watch("rollbackOwnerId") ?? ""} initial={userOption(existing.data?.rollbackOwner)} onChange={(value) => form.setValue("rollbackOwnerId", value, { shouldDirty: true })} />
        </Section>

        <Section title="Implementation results">
          {field("implementationStatus", "Implementation status")}
          {field("implementationOutcome", "Success / failure", { select: true, options: ["SUCCESS", "PARTIAL", "FAILURE"] })}
          {field("implementationSummary", "Implementation summary", { multiline: true })}
          {field("serviceImpactSummary", "Service impact observed", { multiline: true })}
          {field("issuesEncountered", "Issues encountered", { multiline: true })}
          {field("resolutionDetails", "Resolution details", { multiline: true })}
        </Section>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button type="submit" variant="contained" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : "Save"}</Button>
          <Button onClick={() => navigate(id ? `/changes/${id}` : "/changes")}>Cancel</Button>
        </Box>
      </Box>
      <Dialog open={blocker.state === "blocked"}>
        <DialogTitle>Discard unsaved changes?</DialogTitle>
        <DialogContent>This change request has edits that have not been saved.</DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.reset?.()}>Stay</Button>
          <Button color="error" onClick={() => blocker.proceed?.()}>Leave</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
