import MenuIcon from "@mui/icons-material/Menu";
import { AppBar, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemText, ListSubheader, Toolbar, Typography } from "@mui/material";
import { useState } from "react";
import { Link as RouterLink, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { branding } from "../theme/branding";
import { shell } from "../theme/theme";
import { useAuth } from "../modules/auth/AuthContext";

const drawerWidth = 268;

const links = {
  incidents: [
    { label: "All Incidents", to: "/incidents?view=all" },
    { label: "My Incidents", to: "/incidents?view=mine" },
    { label: "Unassigned Incidents", to: "/incidents?view=unassigned" },
  ],
  modules: [
    { label: "Major Incident Management", to: "/major-incidents" },
    { label: "Problem Management", to: "/problems" },
  ],
  changes: [
    { label: "All Changes", to: "/changes?view=all" },
    { label: "My Changes", to: "/changes?view=mine" },
    { label: "Pending Approvals", to: "/changes?view=pending_approvals" },
    { label: "Scheduled Changes", to: "/changes?view=scheduled" },
    { label: "Emergency Changes", to: "/changes?view=emergency" },
    { label: "Closed Changes", to: "/changes?view=closed" },
  ],
  admin: [
    { label: "Users", to: "/admin/users" },
    { label: "Assignment Groups", to: "/admin/groups" },
    { label: "Categories", to: "/admin/categories" },
    { label: "Configuration Items", to: "/admin/configuration-items" },
    { label: "System Settings", to: "/admin/settings" },
  ],
};

function viewLinkActive(to: string, pathname: string, search: string): boolean {
  const [path, query = ""] = to.split("?");
  if (pathname !== path) return false;
  const view = new URLSearchParams(query).get("view");
  if (!view) return true;
  return (new URLSearchParams(search).get("view") ?? "all") === view;
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const itemSx = {
    borderRadius: 1,
    mx: 1,
    mb: 0.25,
    color: shell.sidebarText,
    "&.active": { bgcolor: shell.sidebarActive, color: "white" },
    "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
  };
  return (
    <>
      <ListItemButton component={NavLink} to="/" end sx={itemSx} onClick={onNavigate}>
        <ListItemText primary="Dashboard" />
      </ListItemButton>
      <ListSubheader sx={{ bgcolor: "transparent", color: shell.sidebarMuted, lineHeight: "32px", mt: 1 }}>Service Management</ListSubheader>
      <Typography sx={{ px: 2.5, py: 0.5, color: shell.sidebarMuted, fontSize: 12, fontWeight: 650 }}>Incident Management</Typography>
      {links.incidents.map((link) => (
        <ListItemButton key={link.to} component={RouterLink} to={link.to} aria-current={viewLinkActive(link.to, location.pathname, location.search) ? "page" : undefined} className={viewLinkActive(link.to, location.pathname, location.search) ? "active" : undefined} sx={{ ...itemSx, pl: 3.5 }} onClick={onNavigate}>
          <ListItemText primary={link.label} />
        </ListItemButton>
      ))}
      <Typography sx={{ px: 2.5, py: 0.5, color: shell.sidebarMuted, fontSize: 12, fontWeight: 650 }}>Change Management</Typography>
      {links.changes.map((link) => (
        <ListItemButton key={link.to} component={RouterLink} to={link.to} aria-current={viewLinkActive(link.to, location.pathname, location.search) ? "page" : undefined} className={viewLinkActive(link.to, location.pathname, location.search) ? "active" : undefined} sx={{ ...itemSx, pl: 3.5 }} onClick={onNavigate}>
          <ListItemText primary={link.label} />
        </ListItemButton>
      ))}
      {links.modules.map((link) => (
        <ListItemButton key={link.to} component={NavLink} to={link.to} sx={itemSx} onClick={onNavigate}>
          <ListItemText primary={link.label} />
        </ListItemButton>
      ))}
      <ListSubheader sx={{ bgcolor: "transparent", color: shell.sidebarMuted, lineHeight: "32px", mt: 1 }}>Administration</ListSubheader>
      {links.admin.map((link) => (
        <ListItemButton key={link.to} component={NavLink} to={link.to} sx={itemSx} onClick={onNavigate}>
          <ListItemText primary={link.label} />
        </ListItemButton>
      ))}
    </>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const drawer = (
    <Box sx={{ height: "100%", bgcolor: shell.sidebar, color: shell.sidebarText, display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", px: 2, py: 2 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 1, bgcolor: shell.accent, color: "white", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13 }}>{branding.mark}</Box>
        <Box>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.1 }}>{branding.name}</Typography>
          <Typography sx={{ color: shell.sidebarMuted, fontSize: 11 }}>{branding.product}</Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: shell.sidebarBorder }} />
      <List sx={{ flex: 1, overflow: "auto", py: 1 }}>
        <NavItems onNavigate={() => setOpen(false)} />
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer variant="temporary" open={open} onClose={() => setOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { md: "none" }, "& .MuiDrawer-paper": { width: drawerWidth } }}>
        {drawer}
      </Drawer>
      <Drawer variant="permanent" sx={{ display: { xs: "none", md: "block" }, width: drawerWidth, flexShrink: 0, "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box", borderRight: 0 } }}>
        {drawer}
      </Drawer>
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" onClick={() => setOpen(true)} sx={{ display: { md: "none" } }} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
            <Box sx={{ flex: 1 }} />
            <Typography variant="body2" color="text.secondary">{user?.name}</Typography>
            <Typography
              component="button"
              onClick={() => { logout(); navigate("/login"); }}
              sx={{ border: 0, bgcolor: "transparent", color: "primary.main", cursor: "pointer", font: "inherit", fontWeight: 650 }}
            >
              Sign out
            </Typography>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
