import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DockerFastApiRuntimeAdapter } from "./docker-fastapi.runtime.js";
import type { RuntimeDeploymentRequest } from "./runtime.types.js";

const request: RuntimeDeploymentRequest = {
  deploymentId: "deployment-docker-1",
  modelId: "model-1",
  modelName: "Sentiment",
  modelVersion: "0.1",
  runtimeModelId: "horizon/ml-sentiment:0.1",
  format: "DOCKER",
  runtime: "docker-fastapi",
  modelArchitecture: "distilbert",
  sizeMb: 1000,
  minRamMb: 512,
  minVramMb: null,
  requiresGpu: false,
  contextLength: null,
};

const response = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

describe("Docker FastAPI runtime adapter", () => {
  it("rejects images outside the approved allowlist", async () => {
    const adapter = new DockerFastApiRuntimeAdapter({ baseUrl: "http://127.0.0.1:8000", approvedImages: new Set(["other/image:1"]), timeoutMs: 20 });
    await assert.rejects(adapter.prepare(request), /not approved/);
  });

  it("polls health, parses prediction responses, and cleans up", async () => {
    const paths: string[] = [];
    const adapter = new DockerFastApiRuntimeAdapter({
      baseUrl: "http://127.0.0.1:8000",
      approvedImages: new Set([request.runtimeModelId!]),
      timeoutMs: 100,
      healthPollIntervalMs: 1,
      fetchImpl: async (input) => {
        const path = String(input);
        paths.push(path);
        return path.endsWith("/health") ? response({ status: "ok" }) : response({ label: "POSITIVE", score: 0.998 });
      },
    });

    const handle = await adapter.prepare(request);
    await adapter.start(request);
    assert.equal(handle.state, "RUNNING");
    assert.match(await adapter.infer(request, "Excellent service"), /POSITIVE/);
    assert.equal(paths.filter((path) => path.endsWith("/health")).length, 1);
    await adapter.stop(handle);
  });

  it("fails when health never becomes ready and removes the container", async () => {
    const adapter = new DockerFastApiRuntimeAdapter({
      baseUrl: "http://127.0.0.1:8000",
      approvedImages: new Set([request.runtimeModelId!]),
      timeoutMs: 5,
      healthPollIntervalMs: 1,
      fetchImpl: async () => response({}, false),
    });
    await adapter.prepare(request);
    await assert.rejects(adapter.start(request), /health|Docker service/i);
  });

  it("uses an already-running FastAPI endpoint without creating a container", async () => {
    const paths: string[] = [];
    const adapter = new DockerFastApiRuntimeAdapter({
      baseUrl: "http://127.0.0.1:8000",
      approvedImages: new Set([request.runtimeModelId!]),
      timeoutMs: 100,
      fetchImpl: async (input) => {
        paths.push(String(input));
        return String(input).endsWith("/health")
          ? response({ status: "ok" })
          : response({ label: "POSITIVE", score: 0.9 });
      },
    });

    const handle = await adapter.prepare(request);
    await adapter.start(request);
    assert.match(await adapter.infer(request, "Excellent service"), /POSITIVE/);
    assert.deepEqual(paths, ["http://127.0.0.1:8000/health", "http://127.0.0.1:8000/predict"]);
    await adapter.stop(handle);
  });
});
