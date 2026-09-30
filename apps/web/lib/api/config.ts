import { apiRequest } from "./client";

export const configApi = {
  get: () => apiRequest<{ success: true; apiBaseUrl: string }>("/api/config"),
};