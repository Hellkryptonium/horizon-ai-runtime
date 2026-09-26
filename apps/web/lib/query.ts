import { useMutation, useQuery } from "@tanstack/react-query";
import { authApi } from "./api/auth";
import { ApiError } from "./api/client";
import { dashboardApi, deploymentsApi, modelsApi, workersApi } from "./api";

export const useWorkersQuery = () => useQuery({ queryKey: ["workers"], queryFn: workersApi.list });
export const useModelsQuery = () => useQuery({ queryKey: ["models"], queryFn: modelsApi.list });
export const useDeploymentsQuery = () => useQuery({ queryKey: ["deployments"], queryFn: deploymentsApi.list });
export const useDeploymentQuery = (id: string) => useQuery({ queryKey: ["deployments", id], queryFn: () => deploymentsApi.get(id) });
export const useDashboardStatsQuery = () => useQuery({ queryKey: ["dashboard", "stats"], queryFn: dashboardApi.stats });
export const useCurrentUserQuery = (enabled = true) => useQuery({ queryKey: ["current-user"], queryFn: authApi.getCurrentUser, enabled, retry: false, select: (response) => response.user });
export const useLoginMutation = () => useMutation({ mutationFn: authApi.login });
export const useRegisterMutation = () => useMutation({ mutationFn: authApi.register });
export const useLogoutMutation = () => useMutation({ mutationFn: authApi.logout });
export const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401;
