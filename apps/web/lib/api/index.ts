import type { Deployment, Model, OwnedWorker, Status } from "../types";
import { apiRequest } from "./client";

export const ownedWorkersApi = {
  list: async (): Promise<OwnedWorker[]> => (await apiRequest<{ success: true; workers: OwnedWorker[] }>("/api/workers")).workers,
  createEnrollment: async (): Promise<{ token: string; expiresAt: string }> => apiRequest<{ success: true; token: string; expiresAt: string }>("/api/workers/enrollment", { method: "POST" }),
};

export const workerProvisioningApi = {
  health: async (workerId: string) => apiRequest<{ success: true; data: { available: boolean; version?: string; location?: string } }>(`/api/workers/${workerId}/runtime/health`),
  install: async (workerId: string) => apiRequest<{ success: true; data: { available: boolean; version?: string; location?: string } }>(`/api/workers/${workerId}/runtime/install`, { method: "POST" }),
  models: async (workerId: string) => apiRequest<{ success: true; data: { models: { name: string; sizeMb?: number }[] } }>(`/api/workers/${workerId}/models/status`),
  pull: async (workerId: string, modelId: string) => apiRequest<{ success: true; data: { models: { name: string; sizeMb?: number }[] } }>(`/api/workers/${workerId}/models/pull`, { method: "POST", body: JSON.stringify({ modelId }) }),
};

type ApiModel = { id: string; name: string; version: string; runtime: string; format: string; sizeMb: number; minRamMb: number; requiresGpu: boolean };
type ApiDeployment = { id: string; modelId: string; workerId: string; status: string; createdAt: string };
const statusMap: Record<string, Status> = { PENDING: "pending", SCHEDULED: "deploying", DEPLOYING: "deploying", RUNNING: "running", FAILED: "failed" };
const toModel = (model: ApiModel): Model => ({ id: model.id, name: model.name, version: model.version, runtime: model.runtime, format: model.format, size: `${model.sizeMb} MB`, ram: `${model.minRamMb} MB`, gpu: model.requiresGpu ? "Required" : "Optional" });

export const modelsApi = {
  list: async (): Promise<Model[]> => (await apiRequest<{ success: true; models: ApiModel[] }>("/api/models")).models.map(toModel),
};

export const deploymentsApi = {
  create: async (modelId: string, workerId: string) => apiRequest<{ success: true; deployment: ApiDeployment }>("/api/deployments", {
    method: "POST",
    body: JSON.stringify({ modelId, workerId }),
  }),
  infer: async (id: string, prompt: string) => apiRequest<{ success: true; response: string }>(`/api/deployments/${id}/inference`, {
    method: "POST",
    body: JSON.stringify({ prompt }),
  }),
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
      name: `Deployment ${deployment.id.slice(0, 8)}`,
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
