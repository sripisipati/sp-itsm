import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Box, Chip, IconButton, Menu, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, TextField } from "@mui/material";
import { getCoreRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { UserLookup } from "../../../shared/components/UserLookup";
import { label, priorities, priorityLabels, severities, severityLabels, statuses, statusLabels } from "../../../shared/utilities/labels";
import { formatDateTime } from "../../../shared/utilities/format";
import type { IncidentListItem } from "../types";

const columns = [
  ["ticketNumber", "Ticket Number"],
  ["description", "Description"],
  ["severity", "Severity"],
  ["priority", "Priority"],
  ["assignedTo", "Assigned To"],
  ["assignedOn", "Assigned On"],
  ["status", "Status"],
  ["createdBy", "Created By"],
  ["createdOn", "Created On"],
  ["updatedBy", "Updated By"],
  ["updatedOn", "Updated On"],
  ["actions", "Actions"],
] as const;

const tone: Record<string, "default" | "primary" | "success" | "warning" | "error"> = {
  NEW: "primary",
  ASSIGNED: "primary",
  IN_PROGRESS: "warning",
  ON_HOLD: "default",
  RESOLVED: "success",
  CLOSED: "default",
  CANCELLED: "error",
  P1: "error",
  P2: "warning",
  CRITICAL: "error",
  HIGH: "warning",
};

export function IncidentTable({
  rows,
  filters,
  sorting,
  onFilter,
  onSort,
}: {
  rows: IncidentListItem[];
  filters: Record<string, string>;
  sorting: SortingState;
  onFilter: (key: string, value: string) => void;
  onSort: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [menu, setMenu] = useState<{ anchor: HTMLElement; row: IncidentListItem } | null>(null);
  const table = useReactTable({
    data: rows,
    columns: useMemo(() => columns.map(([id, header]) => ({ id, header })), []),
    state: { sorting },
    manualSorting: true,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });
  const activeSort = sorting[0]?.id;

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 1500 }}>
        <TableHead>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {columns.map(([id, header]) => (
                <TableCell key={id} sortDirection={activeSort === id ? (sorting[0]?.desc ? "desc" : "asc") : false}>
                  {id === "actions" ? header : (
                    <TableSortLabel active={activeSort === id} direction={activeSort === id && !sorting[0]?.desc ? "asc" : "desc"} onClick={() => onSort(id)}>
                      {header}
                    </TableSortLabel>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
          <TableRow>
            {columns.map(([id]) => (
              <TableCell key={id} sx={{ bgcolor: "#fff" }}>{filterControl(id, filters, onFilter)}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover onClick={() => navigate(`/incidents/${row.id}`)} sx={{ cursor: "pointer" }}>
              <TableCell>
                <RouterLink to={`/incidents/${row.id}`} onClick={(event) => event.stopPropagation()}>{row.ticketNumber}</RouterLink>
              </TableCell>
              <TableCell sx={{ maxWidth: 280 }}>{row.shortDescription}</TableCell>
              <TableCell><Chip size="small" label={label(severityLabels, row.severity)} color={tone[row.severity] ?? "default"} /></TableCell>
              <TableCell><Chip size="small" label={label(priorityLabels, row.priority)} color={tone[row.priority] ?? "default"} /></TableCell>
              <TableCell>{row.assignedTo?.name ?? "—"}</TableCell>
              <TableCell>{formatDateTime(row.assignedOn)}</TableCell>
              <TableCell><Chip size="small" label={label(statusLabels, row.status)} color={tone[row.status] ?? "default"} /></TableCell>
              <TableCell>{row.createdBy?.name ?? "—"}</TableCell>
              <TableCell>{formatDateTime(row.createdAt)}</TableCell>
              <TableCell>{row.updatedBy?.name ?? "—"}</TableCell>
              <TableCell>{formatDateTime(row.updatedAt)}</TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  <Chip size="small" label="View" component="button" onClick={() => navigate(`/incidents/${row.id}`)} clickable />
                  <Chip size="small" label="Edit" component="button" onClick={() => navigate(`/incidents/${row.id}/edit`)} clickable />
                  <IconButton size="small" aria-label="More actions" onClick={(event) => setMenu({ anchor: event.currentTarget, row })}>
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Menu open={Boolean(menu)} anchorEl={menu?.anchor} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { if (menu) navigate(`/incidents/${menu.row.id}?action=assign`); setMenu(null); }}>Assign</MenuItem>
        <MenuItem onClick={() => { if (menu) navigate(`/incidents/${menu.row.id}?action=status`); setMenu(null); }}>Update status</MenuItem>
        <MenuItem onClick={() => { if (menu) void navigator.clipboard.writeText(menu.row.ticketNumber); setMenu(null); }}>Copy ticket number</MenuItem>
      </Menu>
    </Box>
  );
}

function filterControl(id: string, filters: Record<string, string>, onFilter: (key: string, value: string) => void) {
  if (id === "actions") return null;
  if (id === "severity" || id === "priority" || id === "status") {
    const options = id === "severity" ? severities : id === "priority" ? priorities : statuses;
    const names = id === "severity" ? severityLabels : id === "priority" ? priorityLabels : statusLabels;
    const current = id === "status" ? filters.status?.split(",").filter(Boolean) ?? [] : filters[id] ? [filters[id]] : [];
    return (
      <TextField
        select
        size="small"
        fullWidth
        value={id === "status" ? current : filters[id] ?? ""}
        slotProps={{ select: { multiple: id === "status" } }}
        onChange={(event) => {
          const value = event.target.value;
          onFilter(id, Array.isArray(value) ? value.join(",") : value);
        }}
        aria-label={`Filter ${id}`}
      >
        {id !== "status" && <MenuItem value="">All</MenuItem>}
        {options.map((option) => <MenuItem key={option} value={option}>{names[option]}</MenuItem>)}
      </TextField>
    );
  }
  if (id === "assignedTo" || id === "createdBy" || id === "updatedBy") {
    const key = id === "assignedTo" ? "assignedTo" : id === "createdBy" ? "createdBy" : "updatedBy";
    return <UserLookup label="" value={filters[key] ?? ""} onChange={(value) => onFilter(key, value)} />;
  }
  if (id === "assignedOn" || id === "createdOn" || id === "updatedOn") {
    const prefix = id === "assignedOn" ? "assignedOn" : id === "createdOn" ? "createdOn" : "updatedOn";
    return (
      <Box sx={{ display: "grid", gap: 0.5 }}>
        <TextField size="small" type="date" value={filters[`${prefix}From`] ?? ""} onChange={(event) => onFilter(`${prefix}From`, event.target.value)} aria-label={`${id} from`} />
        <TextField size="small" type="date" value={filters[`${prefix}To`] ?? ""} onChange={(event) => onFilter(`${prefix}To`, event.target.value)} aria-label={`${id} to`} />
      </Box>
    );
  }
  const key = id === "description" ? "description" : "ticketNumber";
  return <TextField size="small" fullWidth value={filters[key] ?? ""} onChange={(event) => onFilter(key, event.target.value)} aria-label={`Filter ${id}`} />;
}
