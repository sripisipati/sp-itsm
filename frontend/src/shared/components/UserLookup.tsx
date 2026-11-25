import { Autocomplete, TextField } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { api } from "../services/api";

export interface UserOption {
  id: string;
  name: string;
  email?: string;
}

export function UserLookup({
  label,
  value,
  onChange,
  initial,
  options,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  initial?: UserOption | null;
  options?: UserOption[];
}) {
  const [input, setInput] = useState("");
  const debounced = useDebouncedValue(input, 250);
  const query = useQuery({
    queryKey: ["user-lookup", debounced],
    queryFn: async () => (await api.get<{ data: UserOption[] }>("/users", { params: { search: debounced, pageSize: 10 } })).data.data,
    enabled: !options,
  });
  const choices = useMemo(() => {
    const source = options ?? query.data ?? [];
    const merged = initial ? [initial, ...source.filter((item) => item.id !== initial.id)] : source;
    return merged;
  }, [initial, options, query.data]);
  const selected = choices.find((item) => item.id === value) ?? null;
  return (
    <Autocomplete
      size="small"
      options={choices}
      value={selected}
      inputValue={input}
      onInputChange={(_event, next) => setInput(next)}
      onChange={(_event, next) => onChange(next?.id ?? "")}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(left, right) => left.id === right.id}
      renderInput={(params) => <TextField {...params} label={label} size="small" />}
    />
  );
}
