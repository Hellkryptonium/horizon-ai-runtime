import {
  DeploymentRuntimeNotFoundError,
  InvalidRuntimeDeploymentError,
  UnsupportedRuntimeError,
} from "./runtime.errors.js";
import type { RuntimeAdapter, RuntimeDeploymentRequest, RuntimeHandle } from "./runtime.types.js";

export class RuntimeManager {
  private readonly runtimes = new Map<string, RuntimeHandle>();
  private readonly runtimeAdapters = new Map<string, RuntimeAdapter>();

  constructor(private readonly adapters: ReadonlyMap<string, RuntimeAdapter>) {}

  async startDeployment(request: RuntimeDeploymentRequest): Promise<RuntimeHandle> {
    this.validate(request);

    const existing = this.runtimes.get(request.deploymentId);
    if (existing) return existing;

    const adapter = this.getAdapter(request.runtime);
    await adapter.prepare(request);
    const handle = await adapter.start(request);
    this.runtimes.set(request.deploymentId, handle);
    this.runtimeAdapters.set(request.deploymentId, adapter);
    return handle;
  }

  async stopDeployment(deploymentId: string): Promise<void> {
    const handle = this.runtimes.get(deploymentId);
    if (!handle) throw new DeploymentRuntimeNotFoundError(deploymentId);

    const adapter = this.runtimeAdapters.get(deploymentId);
    if (!adapter) throw new DeploymentRuntimeNotFoundError(deploymentId);
    await adapter.stop(handle);
    this.runtimes.delete(deploymentId);
    this.runtimeAdapters.delete(deploymentId);
  }

  async isDeploymentRunning(deploymentId: string): Promise<boolean> {
    const handle = this.runtimes.get(deploymentId);
    if (!handle) return false;
    const adapter = this.runtimeAdapters.get(deploymentId);
    if (!adapter) return false;
    return adapter.isRunning(handle);
  }

  getRuntime(deploymentId: string): RuntimeHandle | undefined {
    return this.runtimes.get(deploymentId);
  }

  private getAdapter(runtime: string) {
    const adapter = this.adapters.get(runtime);
    if (!adapter) throw new UnsupportedRuntimeError(runtime);
    return adapter;
  }

  private validate(request: RuntimeDeploymentRequest) {
    const requiredStrings: [keyof RuntimeDeploymentRequest, string][] = [
      ["deploymentId", "deploymentId"],
      ["modelId", "modelId"],
      ["modelName", "modelName"],
      ["modelVersion", "modelVersion"],
      ["runtime", "runtime"],
      ["format", "format"],
      ["modelArchitecture", "modelArchitecture"],
    ];

    for (const [field, label] of requiredStrings) {
      if (typeof request[field] !== "string" || request[field].trim() === "") {
        throw new InvalidRuntimeDeploymentError(`${label} must be a non-empty string.`);
      }
    }

    if (!Number.isInteger(request.sizeMb) || request.sizeMb <= 0) {
      throw new InvalidRuntimeDeploymentError("sizeMb must be a positive integer.");
    }
    if (!Number.isInteger(request.minRamMb) || request.minRamMb <= 0) {
      throw new InvalidRuntimeDeploymentError("minRamMb must be a positive integer.");
    }
    if (request.minVramMb !== null && (!Number.isInteger(request.minVramMb) || request.minVramMb < 0)) {
      throw new InvalidRuntimeDeploymentError("minVramMb must be null or a non-negative integer.");
    }
    if (typeof request.requiresGpu !== "boolean") {
      throw new InvalidRuntimeDeploymentError("requiresGpu must be a boolean.");
    }
    if (request.contextLength !== null && (!Number.isInteger(request.contextLength) || request.contextLength <= 0)) {
      throw new InvalidRuntimeDeploymentError("contextLength must be null or a positive integer.");
    }
  }
}
