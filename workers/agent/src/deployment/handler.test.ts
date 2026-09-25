import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DeploymentHandler } from "./handler.js";
import { FakeRuntimeAdapter } from "../runtime/fake.runtime.js";
import { RuntimeManager } from "../runtime/runtime.manager.js";
import type { PendingDeployment } from "./types.js";

const deployment: PendingDeployment = {
  deploymentId: "deployment-1",
  modelId: "model-1",
  workerId: "worker-1",
  status: "SCHEDULED",
  modelName: "Test model",
  modelVersion: "1.0",
  runtimeModelId: null,
  format: "GGUF",
  runtime: "fake",
  sizeMb: 100,
  minRamMb: 500,
  minVramMb: null,
  requiresGpu: false,
  modelArchitecture: "llama",
  contextLength: 2048,
};

describe("deployment handler", () => {
  it("starts a fake runtime and handles duplicates idempotently", async () => {
    const manager = new RuntimeManager(new Map([["fake", new FakeRuntimeAdapter()]]));
    const handler = new DeploymentHandler(manager);
    const first = await handler.handle(deployment);
    const second = await handler.handle(deployment);

    assert.ok(first);
    assert.equal(second?.runtimeId, first.runtimeId);
  });

  it("contains runtime failures and does not throw", async () => {
    const errors: string[] = [];
    const manager = new RuntimeManager(new Map());
    const handler = new DeploymentHandler(manager, undefined, (message) => errors.push(message));

    const result = await handler.handle({ ...deployment, runtime: "llama.cpp" });

    assert.equal(result, undefined);
    assert.match(errors[0] ?? "", /not available/);
  });
});