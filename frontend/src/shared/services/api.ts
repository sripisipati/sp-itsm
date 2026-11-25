import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("itsm.token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);
    if (error.response?.status === 401 && !error.config?.url?.includes("/auth/login")) {
      localStorage.removeItem("itsm.token");
      if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
    }
    const message = error.response?.data?.message;
    const userMessage = Array.isArray(message) ? message.join(" ") : typeof message === "string" ? message : "The request could not be completed.";
    return Promise.reject(Object.assign(error, { userMessage }));
  },
);

export function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "userMessage" in error && typeof error.userMessage === "string") {
    return error.userMessage;
  }
  return "The request could not be completed.";
}
