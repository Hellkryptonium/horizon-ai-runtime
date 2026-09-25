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
