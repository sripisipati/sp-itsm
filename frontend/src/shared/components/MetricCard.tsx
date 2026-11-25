import { Box, Typography } from "@mui/material";

export interface MetricTone {
  light: string;
  main: string;
  dark: string;
  edge: string;
}

export const metricTones = {
  indigo: { light: "#7aa2ff", main: "#3b5bdb", dark: "#1e3a8a", edge: "#16275f" },
  amber: { light: "#ffd166", main: "#f59e0b", dark: "#c2410c", edge: "#9a3412" },
  cyan: { light: "#67e8f9", main: "#0891b2", dark: "#155e75", edge: "#164e63" },
  green: { light: "#86efac", main: "#16a34a", dark: "#166534", edge: "#14532d" },
  violet: { light: "#d8b4fe", main: "#9333ea", dark: "#6b21a8", edge: "#581c87" },
  teal: { light: "#5eead4", main: "#0f766e", dark: "#115e59", edge: "#134e4a" },
  rose: { light: "#fda4af", main: "#e11d48", dark: "#9f1239", edge: "#881337" },
  slate: { light: "#cbd5e1", main: "#475569", dark: "#1e293b", edge: "#0f172a" },
} satisfies Record<string, MetricTone>;

export function MetricCard({
  label,
  value,
  tone,
  selected,
  onClick,
}: {
  label: string;
  value: number | string;
  tone: MetricTone;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={selected ?? false}
      sx={{
        appearance: "none",
        border: 0,
        textAlign: "left",
        cursor: "pointer",
        borderRadius: 2.5,
        px: 2,
        py: 1.75,
        color: "#fff",
        background: `linear-gradient(160deg, ${tone.light} 0%, ${tone.main} 46%, ${tone.dark} 100%)`,
        boxShadow: selected
          ? `inset 0 5px 10px rgba(0,0,0,0.28), 0 2px 0 ${tone.edge}`
          : `inset 0 1px 0 rgba(255,255,255,0.55), 0 8px 0 ${tone.edge}, 0 16px 22px rgba(15, 23, 42, 0.18)`,
        transform: selected ? "perspective(700px) translateY(6px) rotateX(12deg)" : "perspective(700px) rotateX(8deg)",
        transformOrigin: "center bottom",
        transition: "transform 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          transform: "perspective(700px) translateY(-6px) rotateX(2deg) scale(1.03)",
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.65), 0 12px 0 ${tone.edge}, 0 22px 28px rgba(15, 23, 42, 0.22)`,
        },
        "&:focus-visible": {
          outline: "3px solid #ffffff",
          outlineOffset: 3,
        },
      }}
    >
      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.88)", fontWeight: 650 }}>{label}</Typography>
      <Typography variant="h4" sx={{ color: "#fff", textShadow: "0 2px 0 rgba(0,0,0,0.18)" }}>{value}</Typography>
    </Box>
  );
}
