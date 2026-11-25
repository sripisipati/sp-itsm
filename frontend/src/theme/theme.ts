import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#0c3c78", dark: "#08294f", light: "#3d6fad" },
    secondary: { main: "#1f6feb" },
    success: { main: "#1b7f4e" },
    warning: { main: "#b26a00" },
    error: { main: "#b42318" },
    background: { default: "#eef1f6", paper: "#ffffff" },
    text: { primary: "#1b2430", secondary: "#5c6b7a" },
    divider: "#e1e6ee",
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
    h4: { fontSize: "1.5rem", fontWeight: 650, letterSpacing: "-0.02em" },
    h6: { fontWeight: 650 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
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
