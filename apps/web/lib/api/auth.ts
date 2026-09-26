import type { User } from "../types";
import { apiRequest } from "./client";

type AuthResponse = { success: true; user: User };

export const authApi = {
  register: (input: { name: string; email: string; password: string }) => apiRequest<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) => apiRequest<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(input) }),
  getCurrentUser: () => apiRequest<AuthResponse>("/api/auth/me"),
  logout: () => apiRequest<{ success: true }>("/api/auth/logout", { method: "POST" }),
};
