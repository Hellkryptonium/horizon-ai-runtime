import { randomUUID } from "node:crypto";
import {
  DockerImageNotAllowedError,
  DockerHealthCheckFailedError,
  DockerUnavailableError,
  ModelHealthCheckFailedError,
  ModelStartFailedError,
} from "./runtime.errors.js";
import type { DockerClient, DockerContainerStatus } from "./docker.manager.js";
import type { RuntimeAdapter, RuntimeDeploymentRequest, RuntimeHandle } from "./runtime.types.js";

type Fetch = typeof fetch;

const imagePattern = /^[a-z0-9]+(?:[._/-][a-z0-9]+)*(?::[a-zA-Z0-9._-]+)?$/;

export interface DockerFastApiRuntimeOptions {
  client: DockerClient;
  approvedImages: ReadonlySet<string>;
  timeoutMs: number;
  healthPollIntervalMs?: number;
  networkName?: string;
  fetchImpl?: Fetch;
}

export interface DockerPrediction {
  label: string;
  score: number;
}

export class DockerFastApiRuntimeAdapter implements RuntimeAdapter {
  private readonly handles = new Map<string, RuntimeHandle>();
  private readonly client: DockerClient;
  private readonly approvedImages: ReadonlySet<string>;
  private readonly timeoutMs: number;
  private readonly healthPollIntervalMs: number;
  private readonly networkName: string;
  private readonly fetchImpl: Fetch;
  private readonly ports = new Map<string, number>();

  constructor(options: DockerFastApiRuntimeOptions) {
    this.client = options.client;
    this.approvedImages = options.approvedImages;
    this.timeoutMs = options.timeoutMs;
    this.healthPollIntervalMs = options.healthPollIntervalMs ?? 250;
    this.networkName = options.networkName ?? "horizon-runtime";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async prepare(request: RuntimeDeploymentRequest): Promise<RuntimeHandle> {
    const existing = this.findByDeployment(request.deploymentId);
    if (existing) return existing;
    const image = this.requireImage(request);
    if (!(await this.client.isAvailable())) throw new DockerUnavailableError();

    await this.client.ensureNetwork(this.networkName);
    await this.client.pullImage(image);
    const containerId = await this.client.createContainer({
      name: `horizon-${request.deploymentId}`,
      image,
      memoryMb: Math.max(request.minRamMb, 512),
      cpuLimit: 2,
      network: this.networkName,
      port: 8000,
    });
    const handle: RuntimeHandle = { runtimeId: containerId, deploymentId: request.deploymentId, state: "PREPARED" };
    this.handles.set(handle.runtimeId, handle);
    return handle;
  }

  async start(request: RuntimeDeploymentRequest): Promise<RuntimeHandle> {
    const handle = this.findByDeployment(request.deploymentId);
    if (!handle) throw new ModelStartFailedError("Docker container must be prepared before it is started.");
    try {
      await this.client.startContainer(handle.runtimeId);
      await this.waitForHealth(handle.runtimeId);
      handle.state = "RUNNING";
      return handle;
    } catch (error: unknown) {
      await this.cleanup(handle.runtimeId);
      throw new ModelStartFailedError(error instanceof Error ? error.message : "Docker service failed to start.");
    }
  }

  async stop(handle: RuntimeHandle): Promise<void> {
    await this.cleanup(handle.runtimeId);
    this.handles.delete(handle.runtimeId);
    this.ports.delete(handle.runtimeId);
  }

  async isRunning(handle: RuntimeHandle): Promise<boolean> {
    try {
      const status = await this.client.inspectContainer(handle.runtimeId);
      return status.running;
    } catch {
      return false;
    }
  }

  async infer(request: RuntimeDeploymentRequest, prompt: string): Promise<string> {
    const handle = this.findByDeployment(request.deploymentId);
    if (!handle) throw new ModelStartFailedError("Docker deployment is not available.");
    const port = await this.getPort(handle.runtimeId);
    const response = await this.request(port, "/predict", {
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

  private async waitForHealth(containerId: string): Promise<void> {
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      try {
        const port = await this.getPort(containerId);
        const response = await this.request(port, "/health");
        if (response.ok) return;
      } catch {
        // The service may need a few seconds to load its model.
      }
      await new Promise((resolve) => setTimeout(resolve, this.healthPollIntervalMs));
    }
    throw new DockerHealthCheckFailedError();
  }

  private async getPort(containerId: string): Promise<number> {
    const known = this.ports.get(containerId);
    if (known) return known;
    const status = await this.client.inspectContainer(containerId);
    if (!status.hostPort) throw new ModelStartFailedError("Docker service did not publish its local port.");
    this.ports.set(containerId, status.hostPort);
    return status.hostPort;
  }

  private async request(port: number, path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(`http://127.0.0.1:${port}${path}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private requireImage(request: RuntimeDeploymentRequest): string {
    const image = request.runtimeModelId?.trim() ?? "";
    if (!imagePattern.test(image) || !this.approvedImages.has(image)) throw new DockerImageNotAllowedError(image || "missing");
    return image;
  }

  private async cleanup(containerId: string): Promise<void> {
    try {
      const status: DockerContainerStatus = await this.client.inspectContainer(containerId);
      if (status.running) await this.client.stopContainer(containerId);
    } finally {
      await this.client.removeContainer(containerId);
    }
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