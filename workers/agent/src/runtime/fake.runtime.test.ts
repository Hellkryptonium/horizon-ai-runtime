import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeRuntimeAdapter } from "./fake.runtime.js";
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

describe("fake runtime", () => {
  it("prepares, starts, checks, and stops an in-memory runtime", async () => {
    const runtime = new FakeRuntimeAdapter();
    const prepared = await runtime.prepare(request);

    assert.equal(prepared.state, "PREPARED");
    assert.equal(await runtime.isRunning(prepared), false);

    const started = await runtime.start(request);
    assert.equal(started.state, "RUNNING");
    assert.equal(await runtime.isRunning(started), true);

    await runtime.stop(started);
    assert.equal(started.state, "STOPPED");
    assert.equal(await runtime.isRunning(started), false);
  });
});