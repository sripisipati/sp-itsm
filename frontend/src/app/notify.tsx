import { Alert, Snackbar } from "@mui/material";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Notice = { message: string; severity: "success" | "error" | "info" };

const NotifyContext = createContext<(message: string, severity?: Notice["severity"]) => void>(() => undefined);

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const notify = useCallback((message: string, severity: Notice["severity"] = "success") => {
    setNotice({ message, severity });
  }, []);
  const value = useMemo(() => notify, [notify]);
  return (
    <NotifyContext.Provider value={value}>
      {children}
      <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity={notice?.severity ?? "info"} onClose={() => setNotice(null)} variant="filled">
          {notice?.message}
        </Alert>
      </Snackbar>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  return useContext(NotifyContext);
}
