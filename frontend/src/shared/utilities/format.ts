const timeZone = import.meta.env.VITE_TIME_ZONE || "UTC";

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function formatDate(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}
