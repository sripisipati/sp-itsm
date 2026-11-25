import { Alert, Box, Button, Paper, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { api, errorMessage } from "../../../shared/services/api";
import { formatDateTime } from "../../../shared/utilities/format";
import { pretty } from "../options";

interface CalendarChange {
  id: string;
  number: string;
  shortDescription: string;
  state: string;
  type: string;
  riskLevel: string | null;
  plannedStart: string;
  plannedEnd: string;
}

export function ChangeCalendarPage() {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const from = cursor.toISOString();
  const to = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)).toISOString();
  const calendar = useQuery({
    queryKey: ["change-calendar", from],
    queryFn: async () => (await api.get<{ data: { changes: CalendarChange[]; maintenanceWindows: Array<{ id: string; name: string; startAt: string; endAt: string }>; blackoutPeriods: Array<{ id: string; name: string; startAt: string; endAt: string }> } }>("/changes/calendar", { params: { from, to } })).data.data,
  });
  const days = useMemo(() => {
    const count = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
    return Array.from({ length: count }, (_item, index) => index + 1);
  }, [cursor]);
  const label = cursor.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  function shift(amount: number) {
    setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + amount, 1)));
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4">Change calendar</Typography>
          <Typography color="text.secondary">Scheduled changes, maintenance windows, and blackout periods. Times are stored in UTC.</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={() => shift(-1)}>Previous</Button>
          <Button onClick={() => shift(1)}>Next</Button>
        </Box>
      </Box>
      <Typography variant="h6">{label}</Typography>
      {calendar.isError && <Alert severity="error">{errorMessage(calendar.error)}</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 1 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <Typography key={day} variant="caption" color="text.secondary">{day}</Typography>)}
        {Array.from({ length: (new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)).getUTCDay() + 6) % 7 }).map((_item, index) => <Box key={`pad-${index}`} />)}
        {days.map((day) => {
          const start = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day));
          const end = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day + 1));
          const changes = (calendar.data?.changes ?? []).filter((item) => new Date(item.plannedStart) < end && new Date(item.plannedEnd) > start);
          const blackouts = (calendar.data?.blackoutPeriods ?? []).filter((item) => new Date(item.startAt) < end && new Date(item.endAt) > start);
          return (
            <Paper key={day} sx={{ p: 1, minHeight: 96, bgcolor: blackouts.length ? "warning.light" : "background.paper" }}>
              <Typography variant="caption">{day}</Typography>
              {changes.map((item) => (
                <Typography key={item.id} component={RouterLink} to={`/changes/${item.id}`} variant="caption" sx={{ display: "block" }}>
                  {item.number}
                </Typography>
              ))}
            </Paper>
          );
        })}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { md: "1fr 1fr 1fr" }, gap: 1 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6">Scheduled changes</Typography>
          {(calendar.data?.changes ?? []).map((item) => (
            <Typography key={item.id} variant="body2" sx={{ py: 0.5 }}>
              <RouterLink to={`/changes/${item.id}`}>{item.number}</RouterLink> · {pretty(item.state)} · {pretty(item.riskLevel)} · {formatDateTime(item.plannedStart)} – {formatDateTime(item.plannedEnd)} · {item.shortDescription}
            </Typography>
          ))}
          {(calendar.data?.changes.length ?? 0) === 0 && <Typography color="text.secondary">No changes in this month.</Typography>}
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6">Maintenance windows</Typography>
          {(calendar.data?.maintenanceWindows ?? []).map((item) => <Typography key={item.id} variant="body2">{item.name} · {formatDateTime(item.startAt)} – {formatDateTime(item.endAt)}</Typography>)}
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6">Blackout periods</Typography>
          {(calendar.data?.blackoutPeriods ?? []).map((item) => <Typography key={item.id} variant="body2">{item.name} · {formatDateTime(item.startAt)} – {formatDateTime(item.endAt)}</Typography>)}
        </Paper>
      </Box>
    </Box>
  );
}
