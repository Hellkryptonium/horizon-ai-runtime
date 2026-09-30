import type { ApiToken, Deployment, Model, OwnedWorker, Status } from "../types";
import { apiRequest } from "./client";

export const ownedWorkersApi = {
  list: async (): Promise<OwnedWorker[]> => (await apiRequest<{ success: true; workers: OwnedWorker[] }>("/api/workers")).workers,
  createEnrollment: async (): Promise<{ token: string; expiresAt: string }> => apiRequest<{ success: true; token: string; expiresAt: string }>("/api/workers/enrollment", { method: "POST" }),
  revoke: async (workerId: string) => apiRequest<void>(`/api/workers/${workerId}`, { method: "DELETE" }),
  terminal: async (workerId: string, command: string) => apiRequest<{ success: true; output: { kind: string; text: string }[]; exit?: boolean }>(`/api/workers/${workerId}/terminal`, { method: "POST", body: JSON.stringify({ command }) }),
  terminalHistory: async (workerId: string) => apiRequest<{ success: true; history: { requestId: string; command: string; output: { kind: string; text: string }[]; exit?: boolean; createdAt: string }[] }>(`/api/workers/${workerId}/terminal/history`),
};

export const apiKeysApi = {
  list: async (): Promise<ApiToken[]> => (await apiRequest<{ success: true; keys: ApiToken[] }>("/api/keys")).keys,
  create: async (name: string) => apiRequest<{ success: true; key: ApiToken; token: string }>("/api/keys", { method: "POST", body: JSON.stringify({ name }) }),
  revoke: async (id: string) => apiRequest<void>(`/api/keys/${id}`, { method: "DELETE" }),
};

export const workerProvisioningApi = {
  health: async (workerId: string) => apiRequest<{ success: true; data: { available: boolean; version?: string; location?: string } }>(`/api/workers/${workerId}/runtime/health`),
  install: async (workerId: string) => apiRequest<{ success: true; data: { available: boolean; version?: string; location?: string } }>(`/api/workers/${workerId}/runtime/install`, { method: "POST" }),
  models: async (workerId: string) => apiRequest<{ success: true; data: { models: { name: string; sizeMb?: number }[] } }>(`/api/workers/${workerId}/models/status`),
  pull: async (workerId: string, modelId: string) => apiRequest<{ success: true; data: { models: { name: string; sizeMb?: number }[] } }>(`/api/workers/${workerId}/models/pull`, { method: "POST", body: JSON.stringify({ modelId }) }),
};

type ApiModel = { id: string; name: string; version: string; runtime: string; format: string; sizeMb: number; minRamMb: number; requiresGpu: boolean };
type ApiModelMetadata = { id: string; name: string; version: string; format: string; runtime: string; runtimeModelId: string | null; sizeMb: number; minRamMb: number; minVramMb: number | null; requiresGpu: boolean; modelArchitecture: string; contextLength: number | null; downloadUrl: string | null };
type ModelInput = Omit<ApiModelMetadata, "id">;
type ApiDeployment = { id: string; name?: string | null; modelId: string; workerId: string; status: string; createdAt: string };
const statusMap: Record<string, Status> = { PENDING: "pending", SCHEDULED: "deploying", DEPLOYING: "deploying", RUNNING: "running", STOPPING: "stopping", STOPPED: "stopped", FAILED: "failed" };
const toModel = (model: ApiModel): Omit<Model, "metadata"> => ({ id: model.id, name: model.name, version: model.version, runtime: model.runtime, format: model.format, size: `${model.sizeMb} MB`, ram: `${model.minRamMb} MB`, gpu: model.requiresGpu ? "Required" : "Optional" });

export const modelsApi = {
  list: async (): Promise<Model[]> => (await apiRequest<{ success: true; models: ApiModelMetadata[] }>("/api/models")).models.map((model) => ({ ...toModel(model), metadata: model })),
  create: async (model: ModelInput) => apiRequest<{ success: true; model: ApiModelMetadata }>("/api/models", { method: "POST", body: JSON.stringify(model) }),
  update: async (modelId: string, model: ModelInput) => apiRequest<{ success: true; model: ApiModelMetadata }>(`/api/models/${modelId}`, { method: "PATCH", body: JSON.stringify(model) }),
  remove: async (modelId: string) => apiRequest<void>(`/api/models/${modelId}`, { method: "DELETE" }),
};

export const deploymentsApi = {
  create: async (modelId: string, workerId: string, name?: string, workerIds?: string[]) => apiRequest<{ success: true; deployment: ApiDeployment }>("/api/deployments", {
    method: "POST",
    body: JSON.stringify({ modelId, workerId, ...(name ? { name } : {}), ...(workerIds?.length ? { workerIds } : {}) }),
  }),
  infer: async (id: string, prompt: string) => apiRequest<{ success: true; response: string }>(`/api/deployments/${id}/inference`, {
    method: "POST",
    body: JSON.stringify({ prompt }),
  }),
  stop: async (id: string) => apiRequest<{ success: true; deployment: ApiDeployment }>(`/api/deployments/${id}/stop`, { method: "POST" }),
  restart: async (id: string) => apiRequest<{ success: true; deployment: ApiDeployment }>(`/api/deployments/${id}/restart`, { method: "POST" }),
  update: async (id: string, name: string) => apiRequest<{ success: true; deployment: ApiDeployment }>(`/api/deployments/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  remove: async (id: string) => apiRequest<void>(`/api/deployments/${id}`, { method: "DELETE" }),
  list: async (): Promise<Deployment[]> => {
    const [deploymentResponse, modelResponse, workerResponse] = await Promise.all([
      apiRequest<{ success: true; deployments: ApiDeployment[] }>("/api/deployments"),
      modelsApi.list(),
      ownedWorkersApi.list(),
    ]);
    const models = new Map(modelResponse.map((model) => [model.id, model]));
    const workers = new Map(workerResponse.map((worker) => [worker.id, worker]));
    return deploymentResponse.deployments.map((deployment) => ({
      id: deployment.id,
      name: deployment.name || `Deployment ${deployment.id.slice(0, 8)}`,
      model: models.get(deployment.modelId)?.name || "Unknown model",
      modelId: deployment.modelId,
      status: statusMap[deployment.status] || "pending",
      worker: workers.get(deployment.workerId)?.name || "Unknown worker",
      workerId: deployment.workerId,
      created: new Date(deployment.createdAt).toLocaleString(),
      endpoint: `/v1/deployments/${deployment.id}/inference`,
      runtime: models.get(deployment.modelId)?.runtime || "Unknown",
    }));
  },
  get: async (id: string): Promise<Deployment | undefined> => (await deploymentsApi.list()).find((deployment) => deployment.id === id),
};

export const inferenceApi = {
  chat: async (deploymentId: string, model: string, messages: { role: "system" | "user" | "assistant"; content: string }[], apiKey: string) => {
    return apiRequest<{ id: string; choices: { message: { content: string } }[]; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }>("/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ deployment_id: deploymentId, model, messages }) });
  },
  requests: async (deploymentId?: string) => (await apiRequest<{ success: true; requests: Array<Record<string, unknown>> }>(`/api/inference/requests${deploymentId ? `?deploymentId=${encodeURIComponent(deploymentId)}` : ""}`)).requests,
  usage: async () => (await apiRequest<{ success: true; usage: Array<{ usage: { promptTokens: number; completionTokens: number; latencyMs: number; createdAt: string }; request: { requestId: string; deploymentId: string } }> }>("/api/inference/usage")).usage,
  replicas: async (deploymentId: string) => (await apiRequest<{ success: true; replicas: Array<{ id: string; workerId: string; activeRequests: number; maxConcurrency: number; lastHealthAt: string | null }> }>(`/api/inference/deployments/${deploymentId}/replicas`)).replicas,
};
