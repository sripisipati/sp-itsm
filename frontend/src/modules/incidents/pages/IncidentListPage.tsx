import { Alert, Box, Button, LinearProgress, Paper, TablePagination, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, errorMessage } from "../../../shared/services/api";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import { SummaryCards } from "../components/SummaryCards";
import { IncidentTable } from "../components/IncidentTable";
import type { IncidentListItem, PageResult } from "../types";

const textKeys = ["ticketNumber", "description", "search"] as const;

export function IncidentListPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const view = params.get("view") ?? "all";
  const [draft, setDraft] = useState<Record<string, string>>({});
  const debounced = useDebouncedValue(draft, 300);
  const filters = useMemo(() => {
    const values: Record<string, string> = {};
    params.forEach((value, key) => { values[key] = value; });
    return { ...values, ...draft };
  }, [draft, params]);
  const requested = useMemo(() => {
    const values: Record<string, string> = {};
    params.forEach((value, key) => { values[key] = value; });
    for (const key of textKeys) {
      if (key in debounced) values[key] = debounced[key];
    }
    return values;
  }, [debounced, params]);

  const queryParams = {
    ...requested,
    view,
    page: Number(params.get("page") ?? 1),
    pageSize: Number(params.get("pageSize") ?? 25),
    sortBy: params.get("sortBy") ?? "createdAt",
    sortOrder: params.get("sortOrder") ?? "desc",
  };
  const list = useQuery({
    queryKey: ["incidents", queryParams],
    queryFn: async () => (await api.get<PageResult<IncidentListItem>>("/incidents", { params: queryParams })).data,
  });
  const summary = useQuery({
    queryKey: ["incident-summary", view],
    queryFn: async () => (await api.get<{ data: { total: number; open: number; inProgress: number; resolved: number } }>("/incidents/summary", { params: { view } })).data.data,
  });

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setParams(next);
  }

  function onFilter(key: string, value: string) {
    if (textKeys.includes(key as (typeof textKeys)[number])) {
      setDraft((current) => ({ ...current, [key]: value }));
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      next.set("page", "1");
      setParams(next);
      return;
    }
    updateParam(key, value);
  }

  const sorting: SortingState = [{ id: queryParams.sortBy, desc: queryParams.sortOrder !== "asc" }];
  const titles: Record<string, string> = { all: "All incidents", mine: "My incidents", unassigned: "Unassigned incidents" };

  async function exportCsv() {
    const response = await api.get("/incidents/export", { params: queryParams, responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "incidents.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4">Incident Management</Typography>
          <Typography color="text.secondary">Create, monitor, assign and resolve IT service incidents.</Typography>
          <Typography variant="body2" color="text.secondary">{titles[view] ?? "All incidents"}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Button variant="contained" onClick={() => navigate("/incidents/new")}>Add Incident</Button>
          <Button variant="outlined" onClick={() => void exportCsv()}>Export to CSV</Button>
          <Button variant="outlined" onClick={() => { void list.refetch(); void summary.refetch(); }}>Refresh</Button>
          <Button variant="text" onClick={() => { setDraft({}); setParams(view === "all" ? {} : { view }); }}>Clear Filters</Button>
        </Box>
      </Box>
      {summary.data && <SummaryCards {...summary.data} />}
      <Paper sx={{ overflow: "hidden" }}>
        {(list.isLoading || list.isFetching) && <LinearProgress />}
        {list.isError && <Alert severity="error" action={<Button onClick={() => void list.refetch()}>Retry</Button>}>{errorMessage(list.error)}</Alert>}
        {!list.isLoading && !list.isError && list.data?.data.length === 0 && (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6">No incidents match these filters</Typography>
            <Typography color="text.secondary">Adjust the column filters or create a new incident.</Typography>
          </Box>
        )}
        {list.data && list.data.data.length > 0 && (
          <IncidentTable
            rows={list.data.data}
            filters={{ ...filters, ...draft }}
            sorting={sorting}
            onFilter={onFilter}
            onSort={(id) => {
              const map: Record<string, string> = { description: "shortDescription", createdOn: "createdAt", updatedOn: "updatedAt", assignedTo: "assignedOn" };
              const sortBy = map[id] ?? id;
              const nextOrder = queryParams.sortBy === sortBy && queryParams.sortOrder === "asc" ? "desc" : "asc";
              const next = new URLSearchParams(params);
              next.set("sortBy", sortBy);
              next.set("sortOrder", nextOrder);
              setParams(next);
            }}
          />
        )}
        <TablePagination
          component="div"
          count={list.data?.pagination.totalRecords ?? 0}
          page={Math.max((list.data?.pagination.page ?? 1) - 1, 0)}
          onPageChange={(_event, page) => updateParam("page", String(page + 1))}
          rowsPerPage={Number(params.get("pageSize") ?? 25)}
          onRowsPerPageChange={(event) => updateParam("pageSize", event.target.value)}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>
    </Box>
  );
}
