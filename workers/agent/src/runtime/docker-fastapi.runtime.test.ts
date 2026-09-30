import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DockerFastApiRuntimeAdapter } from "./docker-fastapi.runtime.js";
import type { DockerClient, DockerContainerOptions, DockerContainerStatus } from "./docker.manager.js";
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

class FakeDockerClient implements DockerClient {
  running = false;
  removed = false;
  options?: DockerContainerOptions;
  async isAvailable() { return true; }
  async ensureNetwork() {}
  async pullImage() {}
  async createContainer(options: DockerContainerOptions) { this.options = options; return "container-1"; }
  async startContainer() { this.running = true; }
  async stopContainer() { this.running = false; }
  async removeContainer() { this.removed = true; }
  async inspectContainer(): Promise<DockerContainerStatus> {
    return { id: "container-1", name: "horizon-deployment-docker-1", running: this.running, hostPort: 43123, status: this.running ? "running" : "created" };
  }
  async logs() { return ""; }
}

const response = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

describe("Docker FastAPI runtime adapter", () => {
  it("rejects images outside the approved allowlist", async () => {
    const adapter = new DockerFastApiRuntimeAdapter({ client: new FakeDockerClient(), approvedImages: new Set(["other/image:1"]), timeoutMs: 20 });
    await assert.rejects(adapter.prepare(request), /not approved/);
  });

  it("polls health, parses prediction responses, and cleans up", async () => {
    const client = new FakeDockerClient();
    const paths: string[] = [];
    const adapter = new DockerFastApiRuntimeAdapter({
      client,
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
    assert.equal(client.removed, true);
  });

  it("fails when health never becomes ready and removes the container", async () => {
    const client = new FakeDockerClient();
    const adapter = new DockerFastApiRuntimeAdapter({
      client,
      approvedImages: new Set([request.runtimeModelId!]),
      timeoutMs: 5,
      healthPollIntervalMs: 1,
      fetchImpl: async () => response({}, false),
    });
    await adapter.prepare(request);
    await assert.rejects(adapter.start(request), /health|Docker service/i);
    assert.equal(client.removed, true);
  });
});
