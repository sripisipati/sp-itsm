import { Autocomplete, TextField } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import { api } from "../../../shared/services/api";

interface RecordOption {
  id: string;
  label: string;
}

export function RecordLookup({
  label,
  resource,
  value,
  onChange,
  initialLabel,
}: {
  label: string;
  resource: "incidents" | "problems";
  value: string;
  onChange: (id: string) => void;
  initialLabel?: string;
}) {
  const [input, setInput] = useState("");
  const debounced = useDebouncedValue(input, 250);
  const query = useQuery({
    queryKey: ["record-lookup", resource, debounced],
    queryFn: async () => {
      const response = await api.get<{ data: Array<{ id: string; ticketNumber?: string; number?: string; shortDescription: string }> }>(`/${resource}`, {
        params: { search: debounced, pageSize: 10 },
      });
      return response.data.data.map((item) => ({
        id: item.id,
        label: `${item.ticketNumber ?? item.number ?? "Record"} · ${item.shortDescription}`,
      }));
    },
  });
  const options = useMemo(() => {
    const source = query.data ?? [];
    if (value && !source.some((item) => item.id === value)) {
      return [{ id: value, label: initialLabel || "Selected record" }, ...source];
    }
    return source;
  }, [initialLabel, query.data, value]);
  const selected = options.find((item) => item.id === value) ?? null;
  return (
    <Autocomplete
      size="small"
      options={options}
      value={selected}
      inputValue={input}
      onInputChange={(_event, next) => setInput(next)}
      onChange={(_event, next: RecordOption | null) => onChange(next?.id ?? "")}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(left, right) => left.id === right.id}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}
