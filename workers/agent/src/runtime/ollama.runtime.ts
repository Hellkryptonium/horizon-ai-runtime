import { randomUUID } from "node:crypto";
import {
  ModelHealthCheckFailedError,
  ModelNotAvailableError,
  ModelStartFailedError,
  OllamaUnavailableError,
} from "./runtime.errors.js";
import type { RuntimeAdapter, RuntimeDeploymentRequest, RuntimeHandle } from "./runtime.types.js";

type Fetch = typeof fetch;

export interface OllamaRuntimeOptions {
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: Fetch;
}

interface OllamaTagsResponse {
  models?: { name?: string }[];
}

interface OllamaGenerateResponse {
  response?: unknown;
}

export class OllamaRuntimeAdapter implements RuntimeAdapter {
  private readonly handles = new Map<string, RuntimeHandle>();
  private readonly fetchImpl: Fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: OllamaRuntimeOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.request("/api/version");
      if (!response.ok) return false;
      const body = (await response.json()) as { version?: unknown };
      return typeof body.version === "string" && body.version.length > 0;
    } catch {
      return false;
    }
  }

  async ensureModel(runtimeModelId: string): Promise<void> {
    if (!(await this.isAvailable())) throw new OllamaUnavailableError(this.baseUrl);

    let response: Response;
    try {
      response = await this.request("/api/tags");
    } catch {
      throw new OllamaUnavailableError(this.baseUrl);
    }

    if (!response.ok) {
      throw new OllamaUnavailableError(this.baseUrl);
    }

    const body = (await response.json()) as OllamaTagsResponse;
    const modelExists = body.models?.some((model) => model.name === runtimeModelId) ?? false;
    if (!modelExists) throw new ModelNotAvailableError(runtimeModelId);
  }

  async prepare(request: RuntimeDeploymentRequest): Promise<RuntimeHandle> {
    const existing = this.findByDeployment(request.deploymentId);
    if (existing) return existing;

    const runtimeModelId = this.requireModelId(request);
    await this.ensureModel(runtimeModelId);

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
    if (!handle) throw new ModelStartFailedError("Runtime must be prepared before it is started.");

    const runtimeModelId = this.requireModelId(request);
    let response: Response;
    try {
      response = await this.request("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: runtimeModelId,
          prompt: "Reply with OK.",
          stream: false,
          keep_alive: "5m",
          options: { num_predict: 1 },
        }),
      });
    } catch (error: unknown) {
      throw new ModelStartFailedError(error instanceof Error ? error.message : "Ollama request failed.");
    }

    if (!response.ok) {
      throw new ModelStartFailedError(`Ollama returned HTTP ${response.status}.`);
    }

    const body = (await response.json()) as OllamaGenerateResponse;
    if (typeof body.response !== "string") {
      throw new ModelHealthCheckFailedError(runtimeModelId);
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

  private requireModelId(request: RuntimeDeploymentRequest): string {
    if (!request.runtimeModelId || request.runtimeModelId.trim() === "") {
      throw new ModelNotAvailableError("missing runtimeModelId");
    }
    return request.runtimeModelId;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(new URL(path, `${this.baseUrl}/`), {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private findByDeployment(deploymentId: string) {
    return [...this.handles.values()].find((handle) => handle.deploymentId === deploymentId);
  }
}
