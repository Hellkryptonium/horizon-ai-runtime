import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OllamaRuntimeAdapter } from "./ollama.runtime.js";
import {
  ModelHealthCheckFailedError,
  ModelNotAvailableError,
  OllamaUnavailableError,
} from "./runtime.errors.js";
import { RuntimeManager } from "./runtime.manager.js";
import type { RuntimeDeploymentRequest } from "./runtime.types.js";

const request: RuntimeDeploymentRequest = {
  deploymentId: "deployment-ollama-1",
  modelId: "model-1",
  modelName: "Qwen 2.5 3B",
  modelVersion: "3b",
  runtimeModelId: "qwen2.5:3b",
  format: "OLLAMA",
  runtime: "ollama",
  modelArchitecture: "qwen",
  sizeMb: 3000,
  minRamMb: 4096,
  minVramMb: null,
  requiresGpu: false,
  contextLength: 4096,
};

const response = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
}) as Response;

const createFetch = (handlers: Record<string, unknown>, calls: string[] = []) => async (input: RequestInfo | URL) => {
  const path = new URL(String(input)).pathname;
  calls.push(path);
  const body = handlers[path];
  if (body instanceof Error) throw body;
  return response(body ?? {});
};

const createAvailableAdapter = (calls: string[] = []) => new OllamaRuntimeAdapter({
  baseUrl: "http://localhost:11434",
  timeoutMs: 1000,
  fetchImpl: createFetch({
    "/api/version": { version: "0.3.0" },
    "/api/tags": { models: [{ name: "qwen2.5:3b" }] },
    "/api/generate": { response: "OK" },
  }, calls),
});

describe("Ollama runtime adapter", () => {
  it("returns false when Ollama is unavailable", async () => {
    const adapter = new OllamaRuntimeAdapter({
      baseUrl: "http://localhost:11434",
      timeoutMs: 1000,
      fetchImpl: createFetch({ "/api/version": new Error("connection refused") }),
    });

    assert.equal(await adapter.isAvailable(), false);
  });

  it("detects a valid Ollama response", async () => {
    const adapter = createAvailableAdapter();
    assert.equal(await adapter.isAvailable(), true);
  });

  it("accepts an installed local model and performs a health response", async () => {
    const calls: string[] = [];
    const adapter = createAvailableAdapter(calls);
    const handle = await adapter.prepare(request);
    const started = await adapter.start(request);

    assert.equal(handle.runtimeId, started.runtimeId);
    assert.equal(started.state, "RUNNING");
    assert.deepEqual(calls, ["/api/version", "/api/tags", "/api/generate"]);
    assert.equal(await adapter.isRunning(started), true);
  });

  it("rejects a model that is not installed locally", async () => {
    const adapter = new OllamaRuntimeAdapter({
      baseUrl: "http://localhost:11434",
      timeoutMs: 1000,
      fetchImpl: createFetch({
        "/api/version": { version: "0.3.0" },
        "/api/tags": { models: [{ name: "another-model" }] },
      }),
    });

    await assert.rejects(
      adapter.prepare(request),
      (error: unknown) => error instanceof ModelNotAvailableError && error.code === "MODEL_NOT_AVAILABLE",
    );
  });

  it("reports unavailable Ollama during model preparation", async () => {
    const adapter = new OllamaRuntimeAdapter({
      baseUrl: "http://localhost:11434",
      timeoutMs: 1000,
      fetchImpl: createFetch({ "/api/version": new Error("connection refused") }),
    });

    await assert.rejects(
      adapter.prepare(request),
      (error: unknown) => error instanceof OllamaUnavailableError && error.code === "OLLAMA_UNAVAILABLE",
    );
  });

  it("fails when the model does not return a usable response", async () => {
    const adapter = new OllamaRuntimeAdapter({
      baseUrl: "http://localhost:11434",
      timeoutMs: 1000,
      fetchImpl: createFetch({
        "/api/version": { version: "0.3.0" },
        "/api/tags": { models: [{ name: "qwen2.5:3b" }] },
        "/api/generate": { done: true },
      }),
    });

    const handle = await adapter.prepare(request);
    await assert.rejects(
      adapter.start(request),
      (error: unknown) => error instanceof ModelHealthCheckFailedError && error.code === "MODEL_HEALTH_CHECK_FAILED",
    );
    assert.equal(handle.state, "PREPARED");
  });

  it("keeps duplicate deployments as one logical runtime", async () => {
    const calls: string[] = [];
    const adapter = createAvailableAdapter(calls);
    const manager = new RuntimeManager(new Map([["ollama", adapter]]));
    const first = await manager.startDeployment(request);
    const second = await manager.startDeployment(request);

    assert.equal(first.runtimeId, second.runtimeId);
    assert.equal(calls.filter((path) => path === "/api/generate").length, 1);
  });
});
