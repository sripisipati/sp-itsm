import { Alert, Box, Button, LinearProgress, MenuItem, Paper, TablePagination, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useMemo, type ReactNode } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { MetricCard, metricTones, type MetricTone } from "../../../shared/components/MetricCard";
import { UserLookup } from "../../../shared/components/UserLookup";
import { api, errorMessage } from "../../../shared/services/api";
import { changeStates, pretty } from "../options";
import { formatDateTime } from "../../../shared/utilities/format";

interface Person { id: string; name: string }
interface ChangeRow {
  id: string;
  number: string;
  shortDescription: string;
  type: string;
  category: { id: string; name: string } | null;
  riskLevel: string | null;
  businessImpact: string | null;
  priority: string | null;
  requestedBy: Person | null;
  assignedTo: Person | null;
  assignmentGroup: { id: string; name: string } | null;
  approvalStatus: string;
  state: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  createdBy: Person | null;
  createdAt: string;
  updatedBy: Person | null;
  updatedAt: string;
}
interface PageResult { data: ChangeRow[]; pagination: { page: number; pageSize: number; totalRecords: number; totalPages: number } }
interface Summary {
  cards: Record<string, number>;
  byStatus: Array<{ state: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  byRisk: Array<{ risk: string | null; count: number }>;
  byAssignmentGroup: Array<{ groupName: string; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
  successVsFailed: { success: number; partial: number; failed: number };
  recent: ChangeRow[];
  upcoming: ChangeRow[];
}

const sortFields: Record<string, string> = {
  number: "number",
  shortDescription: "shortDescription",
  type: "type",
  category: "category",
  riskLevel: "riskLevel",
  businessImpact: "businessImpact",
  priority: "priority",
  requestedBy: "requestedBy",
  assignedTo: "assignedTo",
  assignmentGroup: "assignmentGroup",
  approvalStatus: "approvalStatus",
  state: "state",
  plannedStart: "plannedStart",
  plannedEnd: "plannedEnd",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
};

const titles: Record<string, string> = {
  all: "All Changes",
  mine: "My Changes",
  pending_approvals: "Pending Approvals",
  scheduled: "Scheduled Changes",
  emergency: "Emergency Changes",
  closed: "Closed Changes",
};

export function ChangeListPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const view = params.get("view") ?? "all";
  const queryParams = Object.fromEntries(params.entries());
  const list = useQuery({
    queryKey: ["changes", queryParams],
    queryFn: async () => (await api.get<PageResult>("/changes", { params: { ...queryParams, view, page: params.get("page") ?? 1, pageSize: params.get("pageSize") ?? 25 } })).data,
  });
  const summary = useQuery({
    queryKey: ["change-summary"],
    queryFn: async () => (await api.get<{ data: Summary }>("/changes/summary")).data.data,
  });
  const categories = useQuery({
    queryKey: ["change-categories"],
    queryFn: async () => (await api.get<{ data: Array<{ id: string; name: string; parentId?: string | null }> }>("/change-categories")).data.data,
  });
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: async () => (await api.get<{ data: Array<{ id: string; name: string }> }>("/assignment-groups")).data.data,
  });

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setParams(next);
  }

  function toggleSort(field: string) {
    const next = new URLSearchParams(params);
    const current = next.get("sortBy");
    if (current !== field) {
      next.set("sortBy", field);
      next.set("sortOrder", "asc");
    } else if (next.get("sortOrder") === "asc") {
      next.set("sortOrder", "desc");
    } else {
      next.delete("sortBy");
      next.delete("sortOrder");
    }
    next.set("page", "1");
    setParams(next);
  }

  const columns = useMemo<ColumnDef<ChangeRow>[]>(() => [
    { accessorKey: "number", header: "Change Number", cell: ({ row }) => (
      <RouterLink to={`/changes/${row.original.id}`} onClick={(event) => event.stopPropagation()}>{row.original.number}</RouterLink>
    ) },
    { accessorKey: "shortDescription", header: "Short Description" },
    { accessorKey: "type", header: "Change Type" },
    { id: "category", header: "Category", accessorFn: (row) => row.category?.name ?? "" },
    { accessorKey: "riskLevel", header: "Risk" },
    { accessorKey: "businessImpact", header: "Impact" },
    { accessorKey: "priority", header: "Priority" },
    { id: "requestedBy", header: "Requested By", accessorFn: (row) => row.requestedBy?.name ?? "" },
    { id: "assignedTo", header: "Assigned To", accessorFn: (row) => row.assignedTo?.name ?? "" },
    { id: "assignmentGroup", header: "Assignment Group", accessorFn: (row) => row.assignmentGroup?.name ?? "" },
    { accessorKey: "approvalStatus", header: "Approval Status" },
    { accessorKey: "state", header: "State" },
    { id: "plannedStart", header: "Planned Start", accessorFn: (row) => formatDateTime(row.plannedStart) },
    { id: "plannedEnd", header: "Planned End", accessorFn: (row) => formatDateTime(row.plannedEnd) },
    { id: "createdBy", header: "Created By", accessorFn: (row) => row.createdBy?.name ?? "" },
    { id: "createdAt", header: "Created On", accessorFn: (row) => formatDateTime(row.createdAt) },
    { id: "updatedBy", header: "Updated By", accessorFn: (row) => row.updatedBy?.name ?? "" },
    { id: "updatedAt", header: "Updated On", accessorFn: (row) => formatDateTime(row.updatedAt) },
    { id: "actions", header: "Actions", cell: ({ row }) => (
      <Box sx={{ display: "flex", gap: 0.5 }}>
        <Button size="small" onClick={(event) => { event.stopPropagation(); navigate(`/changes/${row.original.id}`); }}>View</Button>
        <Button size="small" onClick={(event) => { event.stopPropagation(); navigate(`/changes/${row.original.id}/edit`); }}>Edit</Button>
      </Box>
    ) },
  ], [navigate]);

  const table = useReactTable({ data: list.data?.data ?? [], columns, getCoreRowModel: getCoreRowModel() });

  async function exportCsv() {
    const response = await api.get("/changes/export", { params: queryParams, responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "changes.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const cards = summary.data?.cards;

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4">Change Management</Typography>
          <Typography color="text.secondary">Plan, assess, approve, schedule and manage IT changes</Typography>
          <Typography variant="body2" color="text.secondary">{titles[view] ?? "All Changes"}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button variant="contained" onClick={() => navigate("/changes/new")}>Add Change</Button>
          <Button variant="outlined" onClick={() => void exportCsv()}>Export</Button>
          <Button variant="outlined" onClick={() => { void list.refetch(); void summary.refetch(); }}>Refresh</Button>
        </Box>
      </Box>
      {cards && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 2, pb: 1.5 }}>
          {([
            ["Total", cards.total, "", metricTones.indigo],
            ["Draft", cards.draft, "DRAFT", metricTones.slate],
            ["Pending Approval", cards.pendingApproval, "PENDING_APPROVAL", metricTones.amber],
            ["Approved", cards.approved, "APPROVED", metricTones.teal],
            ["Scheduled", cards.scheduled, "SCHEDULED", metricTones.violet],
            ["In Progress", cards.implementing, "IMPLEMENTING", metricTones.cyan],
            ["Failed", cards.failed, "FAILED", metricTones.rose],
            ["Closed", cards.closed, "CLOSED", metricTones.green],
          ] as Array<[string, number, string, MetricTone]>).map(([label, value, state, tone]) => (
            <MetricCard
              key={label}
              label={label}
              value={value}
              tone={tone}
              selected={(params.get("state") ?? "") === state}
              onClick={() => setFilter("state", (params.get("state") ?? "") === state ? "" : state)}
            />
          ))}
        </Box>
      )}
      {summary.data && (
        <Box sx={{ display: "grid", gridTemplateColumns: { md: "1fr 1fr 1fr" }, gap: 1 }}>
          <Bars title="By status" rows={summary.data.byStatus.map((row) => ({ label: row.state, count: row.count }))} />
          <Bars title="By type" rows={summary.data.byType.map((row) => ({ label: row.type, count: row.count }))} />
          <Bars title="By risk" rows={summary.data.byRisk.map((row) => ({ label: row.risk ?? "Unset", count: row.count }))} />
          <Bars title="By group" rows={summary.data.byAssignmentGroup.map((row) => ({ label: row.groupName, count: row.count }))} />
          <Bars title="By month" rows={summary.data.byMonth.map((row) => ({ label: String(row.month).slice(0, 7), count: row.count }))} />
          <Bars title="Success vs failed" rows={[
            { label: "Success", count: summary.data.successVsFailed.success },
            { label: "Partial", count: summary.data.successVsFailed.partial },
            { label: "Failed", count: summary.data.successVsFailed.failed },
          ]} />
        </Box>
      )}
      <Paper sx={{ overflow: "auto" }}>
        {list.isFetching && <LinearProgress />}
        {list.isError && <Alert severity="error">{errorMessage(list.error)}</Alert>}
        <Box sx={{ p: 1, display: "flex", gap: 1 }}>
          <TextField size="small" label="Search" value={params.get("search") ?? ""} onChange={(event) => setFilter("search", event.target.value)} />
          <Button onClick={() => setParams(view === "all" ? {} : { view })}>Clear all</Button>
        </Box>
        <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13, "& th, & td": { borderBottom: "1px solid", borderColor: "divider", p: 0.75, textAlign: "left", whiteSpace: "nowrap" } }}>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const field = sortFields[header.id];
                  const active = params.get("sortBy") === field;
                  return (
                    <th key={header.id}>
                      {field ? (
                        <Button size="small" onClick={() => toggleSort(field)} sx={{ fontWeight: 700, textTransform: "none" }}>
                          {flexRender(header.column.columnDef.header, header.getContext())}{active ? (params.get("sortOrder") === "desc" ? " ↓" : " ↑") : ""}
                        </Button>
                      ) : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
            <tr>
              <FilterCell><TextField size="small" value={params.get("number") ?? ""} onChange={(event) => setFilter("number", event.target.value)} slotProps={{ htmlInput: { "aria-label": "Filter number" } }} /></FilterCell>
              <FilterCell><TextField size="small" value={params.get("shortDescription") ?? ""} onChange={(event) => setFilter("shortDescription", event.target.value)} slotProps={{ htmlInput: { "aria-label": "Filter short description" } }} /></FilterCell>
              <FilterCell><SelectFilter label="Filter type" value={params.get("type") ?? ""} onChange={(value) => setFilter("type", value)} options={["STANDARD", "NORMAL", "EMERGENCY"]} /></FilterCell>
              <FilterCell><SelectFilter value={params.get("categoryId") ?? ""} onChange={(value) => setFilter("categoryId", value)} options={(categories.data ?? []).map((item) => item.id)} labels={Object.fromEntries((categories.data ?? []).map((item) => [item.id, item.name]))} /></FilterCell>
              <FilterCell><SelectFilter value={params.get("riskLevel") ?? ""} onChange={(value) => setFilter("riskLevel", value)} options={["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "VERY_LOW"]} /></FilterCell>
              <FilterCell><SelectFilter value={params.get("impact") ?? ""} onChange={(value) => setFilter("impact", value)} options={["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "VERY_LOW"]} /></FilterCell>
              <FilterCell><SelectFilter value={params.get("priority") ?? ""} onChange={(value) => setFilter("priority", value)} options={["CRITICAL", "HIGH", "MODERATE", "LOW", "PLANNING"]} /></FilterCell>
              <FilterCell><UserLookup label="Requested by" value={params.get("requestedById") ?? ""} onChange={(value) => setFilter("requestedById", value)} /></FilterCell>
              <FilterCell><UserLookup label="Assigned to" value={params.get("assignedToId") ?? ""} onChange={(value) => setFilter("assignedToId", value)} /></FilterCell>
              <FilterCell><SelectFilter value={params.get("assignmentGroupId") ?? ""} onChange={(value) => setFilter("assignmentGroupId", value)} options={(groups.data ?? []).map((item) => item.id)} labels={Object.fromEntries((groups.data ?? []).map((item) => [item.id, item.name]))} /></FilterCell>
              <FilterCell><SelectFilter value={params.get("approvalStatus") ?? ""} onChange={(value) => setFilter("approvalStatus", value)} options={["NOT_REQUESTED", "PENDING", "APPROVED", "REJECTED"]} /></FilterCell>
              <FilterCell>
                <TextField
                  select
                  size="small"
                  value={(params.get("state") ?? "").split(",").filter(Boolean)}
                  onChange={(event) => {
                    const next = event.target.value;
                    setFilter("state", Array.isArray(next) ? next.join(",") : String(next));
                  }}
                  sx={{ minWidth: 140 }}
                  slotProps={{ select: { multiple: true, displayEmpty: true, "aria-label": "Filter state" } }}
                >
                  {changeStates.map((state) => <MenuItem key={state} value={state}>{pretty(state)}</MenuItem>)}
                </TextField>
              </FilterCell>
              <FilterCell><DateRange prefix="plannedStart" from={params.get("plannedStartFrom") ?? ""} to={params.get("plannedStartTo") ?? ""} onChange={setFilter} /></FilterCell>
              <FilterCell><DateRange prefix="plannedEnd" from={params.get("plannedEndFrom") ?? ""} to={params.get("plannedEndTo") ?? ""} onChange={setFilter} /></FilterCell>
              <FilterCell><UserLookup label="Created by" value={params.get("createdById") ?? ""} onChange={(value) => setFilter("createdById", value)} /></FilterCell>
              <FilterCell><DateRange prefix="created" from={params.get("createdFrom") ?? ""} to={params.get("createdTo") ?? ""} onChange={setFilter} /></FilterCell>
              <FilterCell><UserLookup label="Updated by" value={params.get("updatedById") ?? ""} onChange={(value) => setFilter("updatedById", value)} /></FilterCell>
              <FilterCell><DateRange prefix="updated" from={params.get("updatedFrom") ?? ""} to={params.get("updatedTo") ?? ""} onChange={setFilter} /></FilterCell>
              <th />
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} onClick={() => navigate(`/changes/${row.original.id}`)} style={{ cursor: "pointer" }}>
                {row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
              </tr>
            ))}
            {!list.isLoading && table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={19}>No changes match these filters.</td></tr>
            )}
          </tbody>
        </Box>
        <TablePagination
          component="div"
          count={list.data?.pagination.totalRecords ?? 0}
          page={Math.max((list.data?.pagination.page ?? 1) - 1, 0)}
          onPageChange={(_event, page) => setFilter("page", String(page + 1))}
          rowsPerPage={Number(params.get("pageSize") ?? 25)}
          onRowsPerPageChange={(event) => setFilter("pageSize", event.target.value)}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>
      {summary.data && (
        <Box sx={{ display: "grid", gridTemplateColumns: { md: "1fr 1fr" }, gap: 1 }}>
          <MiniTable title="Recent changes" rows={summary.data.recent} onOpen={(id) => navigate(`/changes/${id}`)} />
          <MiniTable title="Upcoming scheduled changes" rows={summary.data.upcoming} onOpen={(id) => navigate(`/changes/${id}`)} />
        </Box>
      )}
    </Box>
  );
}

function FilterCell({ children }: { children: ReactNode }) {
  return <th>{children}</th>;
}

function DateRange({ prefix, from, to, onChange }: { prefix: string; from: string; to: string; onChange: (key: string, value: string) => void }) {
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <TextField size="small" type="date" value={from.slice(0, 10)} onChange={(event) => onChange(`${prefix}From`, event.target.value)} slotProps={{ htmlInput: { "aria-label": `Filter ${prefix} from` } }} />
      <TextField size="small" type="date" value={to.slice(0, 10)} onChange={(event) => onChange(`${prefix}To`, event.target.value)} slotProps={{ htmlInput: { "aria-label": `Filter ${prefix} to` } }} />
    </Box>
  );
}

function MiniTable({ title, rows, onOpen }: { title: string; rows: ChangeRow[]; onOpen: (id: string) => void }) {
  return (
    <Paper sx={{ p: 1.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{title}</Typography>
      {rows.length === 0 && <Typography variant="body2" color="text.secondary">None</Typography>}
      {rows.map((row) => (
        <Box key={row.id} sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 0.5 }}>
          <RouterLink to={`/changes/${row.id}`} onClick={(event) => { event.preventDefault(); onOpen(row.id); }}>{row.number}</RouterLink>
          <Typography variant="body2" noWrap sx={{ flex: 1 }}>{row.shortDescription}</Typography>
          <Typography variant="caption">{row.state}</Typography>
        </Box>
      ))}
    </Paper>
  );
}

function SelectFilter({ value, onChange, options, labels, label }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string>; label?: string }) {
  return (
    <TextField select size="small" value={value} onChange={(event) => onChange(event.target.value)} sx={{ minWidth: 110 }} slotProps={{ select: { "aria-label": label } }}>
      <MenuItem value="">All</MenuItem>
      {options.map((option) => <MenuItem key={option} value={option}>{labels?.[option] ?? pretty(option)}</MenuItem>)}
    </TextField>
  );
}

function Bars({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Paper sx={{ p: 1.5 }}>
      <Typography variant="subtitle2" gutterBottom>{title}</Typography>
      {rows.filter((row) => row.count > 0).map((row) => (
        <Box key={row.label} sx={{ display: "grid", gridTemplateColumns: "110px 1fr 24px", gap: 1, alignItems: "center", mb: 0.5 }}>
          <Typography variant="caption" noWrap>{row.label}</Typography>
          <Box sx={{ height: 8, bgcolor: "action.hover", borderRadius: 1 }}><Box sx={{ width: `${(row.count / max) * 100}%`, height: "100%", bgcolor: "primary.main", borderRadius: 1 }} /></Box>
          <Typography variant="caption">{row.count}</Typography>
        </Box>
      ))}
    </Paper>
  );
}
