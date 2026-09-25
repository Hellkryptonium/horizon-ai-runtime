import { randomUUID } from "node:crypto";
import { InvalidRuntimeDeploymentError } from "./runtime.errors.js";
import type { RuntimeAdapter, RuntimeDeploymentRequest, RuntimeHandle } from "./runtime.types.js";

export class FakeRuntimeAdapter implements RuntimeAdapter {
  private readonly handles = new Map<string, RuntimeHandle>();

  async prepare(request: RuntimeDeploymentRequest): Promise<RuntimeHandle> {
    const existing = this.findByDeployment(request.deploymentId);
    if (existing) return existing;

    const handle: RuntimeHandle = {
      runtimeId: randomUUID(),
      deploymentId: request.deploymentId,
      state: "PREPARED",
    };
    this.handles.set(handle.runtimeId, handle);
    return handle;
  }

  async start(request: RuntimeDeploymentRequest): Promise<RuntimeHandle> {
    const handle = this.findByDeployment(request.deploymentId);
    if (!handle) {
      throw new InvalidRuntimeDeploymentError("Runtime must be prepared before it is started.");
    }

    handle.state = "RUNNING";
    return handle;
  }

  async stop(handle: RuntimeHandle): Promise<void> {
    const stored = this.handles.get(handle.runtimeId);
    if (stored) stored.state = "STOPPED";
  }

  async isRunning(handle: RuntimeHandle): Promise<boolean> {
    return this.handles.get(handle.runtimeId)?.state === "RUNNING";
  }

  private findByDeployment(deploymentId: string) {
    return [...this.handles.values()].find((handle) => handle.deploymentId === deploymentId);
  }
}
