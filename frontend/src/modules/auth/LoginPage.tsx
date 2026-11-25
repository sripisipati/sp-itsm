import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { branding } from "../../theme/branding";
import { shell } from "../../theme/theme";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: shell.sidebar, px: 2 }}>
      <Paper component="form" onSubmit={onSubmit} sx={{ width: "100%", maxWidth: 420, p: 4 }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 3 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: "primary.main", color: "white", display: "grid", placeItems: "center", fontWeight: 700 }}>{branding.mark}</Box>
          <Box>
            <Typography variant="h6">{branding.name}</Typography>
            <Typography color="text.secondary" variant="body2">{branding.product}</Typography>
          </Box>
        </Box>
        <Typography variant="h5" sx={{ mb: 0.5 }}>Sign in</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>Use your development directory account.</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} fullWidth required autoFocus sx={{ mb: 2 }} />
        <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} fullWidth required sx={{ mb: 2 }} />
        <Button type="submit" variant="contained" fullWidth disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</Button>
      </Paper>
    </Box>
  );
}
