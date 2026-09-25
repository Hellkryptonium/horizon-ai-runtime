export type RuntimeState = "PREPARED" | "RUNNING" | "STOPPED";

export interface RuntimeDeploymentRequest {
  deploymentId: string;
  modelId: string;
  modelName: string;
  modelVersion: string;
  runtimeModelId?: string | null;
  format: string;
  runtime: string;
  modelArchitecture: string;
  sizeMb: number;
  minRamMb: number;
  minVramMb: number | null;
  requiresGpu: boolean;
  contextLength: number | null;
}

export interface RuntimeHandle {
  runtimeId: string;
  deploymentId: string;
  state: RuntimeState;
}

export interface RuntimeAdapter {
  prepare(request: RuntimeDeploymentRequest): Promise<RuntimeHandle>;
  start(request: RuntimeDeploymentRequest): Promise<RuntimeHandle>;
  stop(handle: RuntimeHandle): Promise<void>;
  isRunning(handle: RuntimeHandle): Promise<boolean>;
}
