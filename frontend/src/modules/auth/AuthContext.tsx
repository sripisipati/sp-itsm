import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, errorMessage } from "../../shared/services/api";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  roles: string[];
  groupIds: string[];
}

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("itsm.token");
    if (!token) {
      setLoading(false);
      return;
    }
    api.get<{ data: SessionUser }>("/auth/me")
      .then((response) => setUser(response.data.data))
      .catch(() => localStorage.removeItem("itsm.token"))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    login: async (email, password) => {
      try {
        const response = await api.post<{ data: { accessToken: string; user: SessionUser; roles: string[]; groupIds: string[] } }>("/auth/login", { email, password });
        localStorage.setItem("itsm.token", response.data.data.accessToken);
        setUser({ ...response.data.data.user, roles: response.data.data.roles, groupIds: response.data.data.groupIds, name: `${response.data.data.user.firstName} ${response.data.data.user.lastName}` });
      } catch (error) {
        throw new Error(errorMessage(error));
      }
    },
    logout: () => {
      localStorage.removeItem("itsm.token");
      setUser(null);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}
