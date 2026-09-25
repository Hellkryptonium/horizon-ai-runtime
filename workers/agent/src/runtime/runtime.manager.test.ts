import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeRuntimeAdapter } from "./fake.runtime.js";
import {
  DeploymentRuntimeNotFoundError,
  InvalidRuntimeDeploymentError,
  UnsupportedRuntimeError,
} from "./runtime.errors.js";
import { RuntimeManager } from "./runtime.manager.js";
import type { RuntimeDeploymentRequest } from "./runtime.types.js";

const request: RuntimeDeploymentRequest = {
  deploymentId: "deployment-1",
  modelId: "model-1",
  modelName: "Test model",
  modelVersion: "1.0",
  format: "GGUF",
  runtime: "fake",
  modelArchitecture: "llama",
  sizeMb: 100,
  minRamMb: 500,
  minVramMb: null,
  requiresGpu: false,
  contextLength: 2048,
};

const createManager = () => new RuntimeManager(new Map([["fake", new FakeRuntimeAdapter()]]));

describe("runtime manager", () => {
  it("prepares and starts the fake runtime", async () => {
    const manager = createManager();
    const handle = await manager.startDeployment(request);

    assert.equal(handle.state, "RUNNING");
    assert.equal(await manager.isDeploymentRunning(request.deploymentId), true);
  });

  it("does not create a second runtime for duplicate deployments", async () => {
    const manager = createManager();
    const first = await manager.startDeployment(request);
    const second = await manager.startDeployment(request);

    assert.equal(second.runtimeId, first.runtimeId);
  });

  it("rejects unsupported runtimes", async () => {
    const manager = createManager();

    await assert.rejects(
      manager.startDeployment({ ...request, runtime: "llama.cpp" }),
      (error: unknown) => error instanceof UnsupportedRuntimeError && error.code === "UNSUPPORTED_RUNTIME",
    );
  });

  it("validates runtime requests", async () => {
    const manager = createManager();

    await assert.rejects(
      manager.startDeployment({ ...request, sizeMb: 0 }),
      (error: unknown) => error instanceof InvalidRuntimeDeploymentError,
    );
  });

  it("stops a runtime and reports missing runtimes without crashing", async () => {
    const manager = createManager();
    await manager.startDeployment(request);
    await manager.stopDeployment(request.deploymentId);

    assert.equal(await manager.isDeploymentRunning(request.deploymentId), false);
    await assert.rejects(
      manager.stopDeployment(request.deploymentId),
      (error: unknown) => error instanceof DeploymentRuntimeNotFoundError,
    );
  });
});