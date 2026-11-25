import { createTheme } from "@mui/material/styles";

const raised = (face: string, edge: string) => ({
  backgroundImage: face,
  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 5px 0 ${edge}, 0 10px 16px rgba(15, 23, 42, 0.2)`,
  "&:hover": {
    transform: "perspective(500px) translateY(-2px) rotateX(4deg)",
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 7px 0 ${edge}, 0 14px 18px rgba(15, 23, 42, 0.24)`,
  },
  "&:active": {
    transform: "perspective(500px) translateY(4px) rotateX(14deg)",
    boxShadow: `inset 0 3px 6px rgba(0,0,0,0.22), 0 1px 0 ${edge}`,
  },
});

export const theme = createTheme({
  palette: {
    primary: { main: "#1d4ed8", dark: "#1e3a8a", light: "#60a5fa" },
    secondary: { main: "#7c3aed" },
    success: { main: "#15803d" },
    warning: { main: "#d97706" },
    error: { main: "#e11d48" },
    background: { default: "#e7eefc", paper: "#ffffff" },
    text: { primary: "#1b2430", secondary: "#5c6b7a" },
    divider: "#e1e6ee",
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
    h4: { fontSize: "1.5rem", fontWeight: 650, letterSpacing: "-0.02em" },
    h6: { fontWeight: 650 },
    button: { textTransform: "none", fontWeight: 700 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#e7eefc",
          backgroundImage: "radial-gradient(900px 420px at 0% -10%, #c7d7ff 0%, transparent 55%), radial-gradient(700px 380px at 100% 0%, #ffd6ea 0%, transparent 50%)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transformOrigin: "center bottom",
          transition: "transform 140ms ease, box-shadow 140ms ease",
          "&.Mui-disabled": { transform: "none", boxShadow: "none" },
        },
        contained: {
          color: "#fff",
          ...raised("linear-gradient(180deg, #7cb3ff 0%, #2563eb 46%, #1d4ed8 100%)", "#1e3a8a"),
          "&.MuiButton-colorSuccess": raised("linear-gradient(180deg, #86efac 0%, #16a34a 50%, #15803d 100%)", "#14532d"),
          "&.MuiButton-colorWarning": { color: "#3f2208", ...raised("linear-gradient(180deg, #fde68a 0%, #f59e0b 50%, #d97706 100%)", "#9a3412") },
          "&.MuiButton-colorError": raised("linear-gradient(180deg, #fda4af 0%, #e11d48 50%, #be123c 100%)", "#881337"),
          "&.MuiButton-colorSecondary": raised("linear-gradient(180deg, #ddd6fe 0%, #8b5cf6 50%, #7c3aed 100%)", "#5b21b6"),
        },
        outlined: {
          borderWidth: 0,
          color: "#5b21b6",
          backgroundImage: "linear-gradient(180deg, #ffffff 0%, #f5f0ff 100%)",
          boxShadow: "inset 0 1px 0 #fff, 0 4px 0 #ddd6fe, 0 8px 14px rgba(91, 33, 182, 0.16)",
          "&:hover": {
            borderWidth: 0,
            backgroundImage: "linear-gradient(180deg, #ffffff 0%, #ede9fe 100%)",
            transform: "perspective(500px) translateY(-2px) rotateX(4deg)",
          },
          "&:active": {
            transform: "perspective(500px) translateY(3px) rotateX(12deg)",
            boxShadow: "inset 0 2px 5px rgba(91, 33, 182, 0.18), 0 1px 0 #ddd6fe",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "linear-gradient(180deg, #ffffff 0%, #f4f7ff 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), 0 10px 0 rgba(199, 210, 254, 0.45), 0 18px 30px rgba(37, 99, 235, 0.08)",
          border: "1px solid #dbe4ff",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { fontSize: 13, padding: "8px 10px" },
        head: { fontWeight: 650, color: "#243140", backgroundColor: "#f8fafc" },
      },
    },
  },
});

export const shell = {
  sidebar: "#0b1f3a",
  sidebarBorder: "#163154",
  sidebarText: "#d5deea",
  sidebarMuted: "#93a4ba",
  sidebarActive: "#16375f",
  accent: "#4c9aff",
};
