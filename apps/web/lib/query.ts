import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "./api/auth";
import { ApiError } from "./api/client";
import { configApi } from "./api/config";
import { apiKeysApi, deploymentsApi, inferenceApi, modelsApi, ownedWorkersApi, workerProvisioningApi } from "./api";

export const useOwnedWorkersQuery = () => useQuery({ queryKey: ["owned-workers"], queryFn: ownedWorkersApi.list });
export const useCreateWorkerEnrollmentMutation = () => useMutation({ mutationFn: ownedWorkersApi.createEnrollment });
export const useRevokeWorkerMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ownedWorkersApi.revoke,
		onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["owned-workers"] }); },
	});
};
export const useWorkerTerminalMutation = () => useMutation({ mutationFn: ({ workerId, command }: { workerId: string; command: string }) => ownedWorkersApi.terminal(workerId, command) });
export const useWorkerTerminalHistoryQuery = (workerId: string, enabled = true) => useQuery({ queryKey: ["terminal-history", workerId], queryFn: () => ownedWorkersApi.terminalHistory(workerId), enabled });
export const useModelsQuery = () => useQuery({ queryKey: ["models"], queryFn: modelsApi.list });
export const useCreateModelMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({ mutationFn: modelsApi.create, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["models"] }); } });
};
export const useUpdateModelMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({ mutationFn: ({ modelId, model }: { modelId: string; model: Parameters<typeof modelsApi.update>[1] }) => modelsApi.update(modelId, model), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["models"] }); } });
};
export const useDeleteModelMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({ mutationFn: modelsApi.remove, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["models"] }); } });
};
export const useDeploymentsQuery = () => useQuery({ queryKey: ["deployments"], queryFn: deploymentsApi.list });
export const useDeploymentQuery = (id: string) => useQuery({ queryKey: ["deployments", id], queryFn: () => deploymentsApi.get(id) });
export const useCreateDeploymentMutation = () => useMutation({ mutationFn: ({ modelId, workerId, name, workerIds }: { modelId: string; workerId: string; name?: string; workerIds?: string[] }) => deploymentsApi.create(modelId, workerId, name, workerIds) });
export const useInferenceMutation = () => useMutation({ mutationFn: ({ deploymentId, prompt }: { deploymentId: string; prompt: string }) => deploymentsApi.infer(deploymentId, prompt) });
export const useChatCompletionMutation = () => useMutation({ mutationFn: ({ deploymentId, model, content, apiKey }: { deploymentId: string; model: string; content: string; apiKey: string }) => inferenceApi.chat(deploymentId, model, [{ role: "user", content }], apiKey) });
export const useInferenceRequestsQuery = (deploymentId?: string) => useQuery({ queryKey: ["inference-requests", deploymentId || "all"], queryFn: () => inferenceApi.requests(deploymentId), refetchInterval: 3000 });
export const useInferenceUsageQuery = () => useQuery({ queryKey: ["inference-usage"], queryFn: inferenceApi.usage, refetchInterval: 10000 });
export const useDeploymentReplicasQuery = (deploymentId: string) => useQuery({ queryKey: ["deployment-replicas", deploymentId], queryFn: () => inferenceApi.replicas(deploymentId), enabled: Boolean(deploymentId), refetchInterval: 5000 });
export const useUpdateDeploymentMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ deploymentId, name }: { deploymentId: string; name: string }) => deploymentsApi.update(deploymentId, name),
		onSuccess: (_, variables) => {
			void queryClient.invalidateQueries({ queryKey: ["deployments"] });
			void queryClient.invalidateQueries({ queryKey: ["deployments", variables.deploymentId] });
		},
	});
};
export const useDeleteDeploymentMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deploymentsApi.remove,
		onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["deployments"] }); },
	});
};
export const useCurrentUserQuery = (enabled = true) => useQuery({ queryKey: ["current-user"], queryFn: authApi.getCurrentUser, enabled, retry: false, select: (response) => response.user });
export const useControlPlaneConfigQuery = () => useQuery({ queryKey: ["control-plane-config"], queryFn: configApi.get, staleTime: 300000, retry: false });
export const useApiKeysQuery = () => useQuery({ queryKey: ["api-keys"], queryFn: apiKeysApi.list });
export const useCreateApiKeyMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({ mutationFn: apiKeysApi.create, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["api-keys"] }); } });
};
export const useRevokeApiKeyMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({ mutationFn: apiKeysApi.revoke, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["api-keys"] }); } });
};
export const useUpdateAccountMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: authApi.updateAccount,
		onSuccess: (response) => { queryClient.setQueryData(["current-user"], { success: true, user: response.user }); },
	});
};
export const useDeleteAccountMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: authApi.deleteAccount,
		onSuccess: () => { queryClient.clear(); },
	});
};
export const useLoginMutation = () => useMutation({ mutationFn: authApi.login });
export const useRegisterMutation = () => useMutation({ mutationFn: authApi.register });
export const useLogoutMutation = () => useMutation({ mutationFn: authApi.logout });
export const useRuntimeHealthMutation = () => useMutation({ mutationFn: workerProvisioningApi.health });
export const useRuntimeInstallMutation = () => useMutation({ mutationFn: workerProvisioningApi.install });
export const useModelStatusMutation = () => useMutation({ mutationFn: workerProvisioningApi.models });
export const useModelPullMutation = () => useMutation({ mutationFn: ({ workerId, modelId }: { workerId: string; modelId: string }) => workerProvisioningApi.pull(workerId, modelId) });
export const useStopDeploymentMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deploymentsApi.stop,
		onSuccess: (_, deploymentId) => {
			void queryClient.invalidateQueries({ queryKey: ["deployments"] });
			void queryClient.invalidateQueries({ queryKey: ["deployments", deploymentId] });
		},
	});
};
export const useRestartDeploymentMutation = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deploymentsApi.restart,
		onSuccess: (_, deploymentId) => {
			void queryClient.invalidateQueries({ queryKey: ["deployments"] });
			void queryClient.invalidateQueries({ queryKey: ["deployments", deploymentId] });
		},
	});
};
export const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401;
