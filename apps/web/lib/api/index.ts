import { dashboardStats, mockDeployments, mockModels, mockWorkers, type Deployment, type Model, type Worker } from "../mock/data";

const delay = async <T,>(value: T): Promise<T> => { await new Promise((resolve) => setTimeout(resolve, 120)); return value; };

export const workersApi = { list: (): Promise<Worker[]> => delay(mockWorkers) };
export const modelsApi = { list: (): Promise<Model[]> => delay(mockModels) };
let deployments = [...mockDeployments];
export const deploymentsApi = {
  list: (): Promise<Deployment[]> => delay(deployments),
  get: (id: string): Promise<Deployment | undefined> => delay(deployments.find((deployment) => deployment.id === id) || deployments[0]),
  create: async (input: Pick<Deployment, "name" | "model" | "modelId" | "worker" | "workerId">): Promise<Deployment> => {
    const created = { ...input, id: "new-deployment", status: "deploying" as const, created: "just now", endpoint: "/v1/deployments/new-deployment/inference", runtime: "Ollama" };
    deployments = [created, ...deployments];
    return delay(created);
  },
};
export const dashboardApi = { stats: () => delay(dashboardStats) };
