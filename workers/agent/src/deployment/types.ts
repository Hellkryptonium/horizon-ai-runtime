export interface PendingDeployment {
  deploymentId: string;
  modelId: string;
  workerId: string;
  status: "SCHEDULED";
  modelName: string;
  modelVersion: string;
  runtimeModelId: string | null;
  format: string;
  runtime: string;
  sizeMb: number;
  minRamMb: number;
  minVramMb: number | null;
  requiresGpu: boolean;
  modelArchitecture: string;
  contextLength: number | null;
}

export interface PendingDeploymentsResponse {
  success: boolean;
  deployments: PendingDeployment[];
}

export interface DeploymentPoller {
  pollNow(): Promise<void>;
  start(): void;
  stop(): void;
}

export interface DeploymentCommand {
  type: "deployment.command";
  version: 1;
  requestId: string;
  workerId: string;
  payload: { deploymentId: string; modelId: string; runtime: "ollama" };
}

export interface InferenceCommand {
  type: "inference.command";
  version: 1;
  requestId: string;
  workerId: string;
  payload: { deploymentId: string; prompt: string };
}

export type ProvisioningOperation = "runtime.health" | "runtime.install" | "model.status" | "model.pull";

export interface ProvisioningCommand {
  type: "runtime.health" | "runtime.install" | "model.status" | "model.pull";
  version: 1;
  requestId: string;
  workerId: string;
  payload: { modelId?: string };
}
