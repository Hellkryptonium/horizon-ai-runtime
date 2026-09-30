import type { DeploymentCommand, DeploymentStopCommand, InferenceCommand, PendingDeployment } from "./types.js";
import { RuntimeManager } from "../runtime/runtime.manager.js";
import type { RuntimeDeploymentRequest, RuntimeHandle } from "../runtime/runtime.types.js";

export class DeploymentHandler {
  constructor(
    private readonly runtimeManager: RuntimeManager,
    private readonly log: (message: string) => void = console.log,
    private readonly errorLog: (message: string) => void = console.error,
    private readonly localOllamaModelId = process.env.OLLAMA_MODEL_ID?.trim() || "qwen2.5:3b",
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

  async handleCommand(command: DeploymentCommand): Promise<RuntimeHandle | undefined> {
    return this.handle({
      deploymentId: command.payload.deploymentId,
      modelId: command.payload.modelId,
      workerId: command.workerId,
      status: "SCHEDULED",
      modelName: command.payload.modelId,
      modelVersion: "direct",
      runtimeModelId: command.payload.runtimeModelId ?? (command.payload.runtime === "ollama" ? this.localOllamaModelId : null),
      format: command.payload.runtime === "ollama" ? "ollama" : "docker-fastapi",
      runtime: command.payload.runtime,
      sizeMb: 1,
      minRamMb: 1,
      minVramMb: null,
      requiresGpu: false,
      modelArchitecture: "unknown",
      contextLength: null,
    });
  }

  async handleInferenceCommand(command: InferenceCommand): Promise<string> {
    return this.runtimeManager.inferDeployment(command.payload.deploymentId, command.payload.prompt);
  }

  async handleStopCommand(command: DeploymentStopCommand): Promise<void> {
    await this.runtimeManager.stopDeployment(command.payload.deploymentId);
  }
}