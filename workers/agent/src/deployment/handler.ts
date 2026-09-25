import type { PendingDeployment } from "./types.js";
import { RuntimeManager } from "../runtime/runtime.manager.js";
import type { RuntimeDeploymentRequest, RuntimeHandle } from "../runtime/runtime.types.js";

export class DeploymentHandler {
  constructor(
    private readonly runtimeManager: RuntimeManager,
    private readonly log: (message: string) => void = console.log,
    private readonly errorLog: (message: string) => void = console.error,
  ) {}

  async handle(deployment: PendingDeployment): Promise<RuntimeHandle | undefined> {
    try {
      const existing = this.runtimeManager.getRuntime(deployment.deploymentId);
      if (existing) {
        this.log(`[runtime] deployment ${deployment.deploymentId} is already handled`);
        return existing;
      }

      const request: RuntimeDeploymentRequest = {
        deploymentId: deployment.deploymentId,
        modelId: deployment.modelId,
        modelName: deployment.modelName,
        modelVersion: deployment.modelVersion,
        runtimeModelId: deployment.runtimeModelId,
        format: deployment.format,
        runtime: deployment.runtime,
        modelArchitecture: deployment.modelArchitecture,
        sizeMb: deployment.sizeMb,
        minRamMb: deployment.minRamMb,
        minVramMb: deployment.minVramMb,
        requiresGpu: deployment.requiresGpu,
        contextLength: deployment.contextLength,
      };

      this.log(`[runtime] preparing deployment ${deployment.deploymentId}`);
      const handle = await this.runtimeManager.startDeployment(request);
      this.log(`[runtime] ${deployment.runtime} deployment started: ${handle.runtimeId}`);
      return handle;
    } catch (error: unknown) {
      this.errorLog(
        `[runtime] deployment ${deployment.deploymentId} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return undefined;
    }
  }
}