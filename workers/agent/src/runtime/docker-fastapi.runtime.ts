import { randomUUID } from "node:crypto";
import { DockerImageNotAllowedError, DockerHealthCheckFailedError, ModelHealthCheckFailedError, ModelStartFailedError } from "./runtime.errors.js";
import type { RuntimeAdapter, RuntimeDeploymentRequest, RuntimeHandle } from "./runtime.types.js";

type Fetch = typeof fetch;

const imagePattern = /^[a-z0-9]+(?:[._/-][a-z0-9]+)*(?::[a-zA-Z0-9._-]+)?$/;

export interface DockerFastApiRuntimeOptions {
  baseUrl: string;
  approvedImages: ReadonlySet<string>;
  timeoutMs: number;
  healthPollIntervalMs?: number;
  fetchImpl?: Fetch;
}

export interface DockerPrediction {
  label: string;
  score: number;
}

export class DockerFastApiRuntimeAdapter implements RuntimeAdapter {
  private readonly handles = new Map<string, RuntimeHandle>();
  private readonly approvedImages: ReadonlySet<string>;
  private readonly timeoutMs: number;
  private readonly healthPollIntervalMs: number;
  private readonly baseUrl: URL;
  private readonly fetchImpl: Fetch;

  constructor(options: DockerFastApiRuntimeOptions) {
    this.baseUrl = new URL(options.baseUrl);
    this.approvedImages = options.approvedImages;
    this.timeoutMs = options.timeoutMs;
    this.healthPollIntervalMs = options.healthPollIntervalMs ?? 250;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async prepare(request: RuntimeDeploymentRequest): Promise<RuntimeHandle> {
    const existing = this.findByDeployment(request.deploymentId);
    if (existing) return existing;
    this.requireImage(request);
    const handle: RuntimeHandle = { runtimeId: `http:${randomUUID()}`, deploymentId: request.deploymentId, state: "PREPARED" };
    this.handles.set(handle.runtimeId, handle);
    return handle;
  }

  async start(request: RuntimeDeploymentRequest): Promise<RuntimeHandle> {
    const handle = this.findByDeployment(request.deploymentId);
    if (!handle) throw new ModelStartFailedError("Docker container must be prepared before it is started.");
    try {
      await this.waitForHealth();
      handle.state = "RUNNING";
      return handle;
    } catch (error: unknown) {
      throw new ModelStartFailedError(error instanceof Error ? error.message : "Docker service failed to start.");
    }
  }

  async stop(handle: RuntimeHandle): Promise<void> {
    this.handles.delete(handle.runtimeId);
  }

  async isRunning(handle: RuntimeHandle): Promise<boolean> {
    try {
      return (await this.request("/health")).ok;
    } catch {
      return false;
    }
  }

  async infer(request: RuntimeDeploymentRequest, prompt: string): Promise<string> {
    const handle = this.findByDeployment(request.deploymentId);
    if (!handle) throw new ModelStartFailedError("Docker deployment is not available.");
    const response = await this.request("/predict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: prompt }),
    });
    if (!response.ok) throw new ModelStartFailedError(`Docker service returned HTTP ${response.status}.`);
    const body = (await response.json()) as Partial<DockerPrediction>;
    if (typeof body.label !== "string" || typeof body.score !== "number" || body.score < 0 || body.score > 1) {
      throw new ModelHealthCheckFailedError(request.modelName);
    }
    return JSON.stringify({ label: body.label, score: body.score });
  }

  private async waitForHealth(): Promise<void> {
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      try {
        const response = await this.request("/health");
        if (response.ok) return;
      } catch {
        // The service may need a few seconds to load its model.
      }
      await new Promise((resolve) => setTimeout(resolve, this.healthPollIntervalMs));
    }
    throw new DockerHealthCheckFailedError();
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const target = new URL(path, `${this.baseUrl.toString().replace(/\/$/, "")}/`).toString();
      return await this.fetchImpl(target, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private requireImage(request: RuntimeDeploymentRequest): string {
    const image = request.runtimeModelId?.trim() ?? "";
    if (!imagePattern.test(image) || !this.approvedImages.has(image)) throw new DockerImageNotAllowedError(image || "missing");
    return image;
  }

  private findByDeployment(deploymentId: string) {
    return [...this.handles.values()].find((handle) => handle.deploymentId === deploymentId);
  }
}

export const defaultDockerFastApiImage = "horizon/ml-sentiment:0.1";

export const parseApprovedDockerImages = (value: string | undefined): ReadonlySet<string> => {
  const images = (value ?? defaultDockerFastApiImage).split(",").map((image) => image.trim()).filter(Boolean);
  return new Set(images.filter((image) => imagePattern.test(image)));
};

export const createDockerFastApiRuntimeId = () => randomUUID();