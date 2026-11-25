import { CircularProgress, Box } from "@mui/material";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { useAuth } from "../modules/auth/AuthContext";
import { LoginPage } from "../modules/auth/LoginPage";
import { CategoriesAdminPage, ConfigurationItemsPage, GroupsAdminPage, SettingsPage, UsersAdminPage } from "../modules/admin/AdminPages";
import { ChangeDetailPage } from "../modules/changes/pages/ChangeDetailPage";
import { ChangeFormPage } from "../modules/changes/pages/ChangeFormPage";
import { ChangeListPage } from "../modules/changes/pages/ChangeListPage";
import { ComingSoonPage } from "../modules/common/ComingSoonPage";
import { DashboardPage } from "../modules/dashboard/pages/DashboardPage";
import { IncidentDetailPage } from "../modules/incidents/pages/IncidentDetailPage";
import { IncidentFormPage } from "../modules/incidents/pages/IncidentFormPage";
import { IncidentListPage } from "../modules/incidents/pages/IncidentListPage";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Box sx={{ display: "grid", placeItems: "center", minHeight: "100vh" }}><CircularProgress /></Box>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <Protected />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "incidents", element: <IncidentListPage /> },
      { path: "incidents/new", element: <IncidentFormPage /> },
      { path: "incidents/:id", element: <IncidentDetailPage /> },
      { path: "incidents/:id/edit", element: <IncidentFormPage /> },
      { path: "major-incidents", element: <ComingSoonPage title="Major Incident Management" /> },
      { path: "problems", element: <ComingSoonPage title="Problem Management" /> },
      { path: "changes", element: <ChangeListPage /> },
      { path: "changes/new", element: <ChangeFormPage /> },
      { path: "changes/:id", element: <ChangeDetailPage /> },
      { path: "changes/:id/edit", element: <ChangeFormPage /> },
      { path: "admin/users", element: <UsersAdminPage /> },
      { path: "admin/groups", element: <GroupsAdminPage /> },
      { path: "admin/categories", element: <CategoriesAdminPage /> },
      { path: "admin/configuration-items", element: <ConfigurationItemsPage /> },
      { path: "admin/settings", element: <SettingsPage /> },
    ],
  },
]);
