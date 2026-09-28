import { describe, expect, it } from "vitest";

import type { Model } from "../models/models.types.js";
import type { DeploymentRepository } from "./deployments.repository.js";
import { DeploymentService, WorkerNotFoundError, WorkerOfflineError } from "./deployments.service.js";
import type { Deployment } from "./deployments.types.js";

const userId = "00000000-0000-4000-8000-000000000010";
const workerId = "00000000-0000-4000-8000-000000000001";
const model: Model = {
  id: "5637017b-585d-4a5c-82be-41acd0002571", name: "Qwen", version: "1.0", format: "GGUF",
  runtime: "ollama", runtimeModelId: "qwen2.5:3b", sizeMb: 3000, minRamMb: 4000,
  minVramMb: null, requiresGpu: false, modelArchitecture: "llama", contextLength: 4096,
  downloadUrl: null, createdAt: new Date(), updatedAt: new Date(),
};
const worker = { id: workerId, userId, status: "ONLINE" as "ONLINE" | "OFFLINE", availableRamMb: 8000, gpu: null, vramMb: null };
const deployment: Deployment = {
  id: "00000000-0000-4000-8000-000000000002", modelId: model.id, workerId, status: "PENDING",
  createdAt: new Date(), updatedAt: new Date(),
};

const repository = (): DeploymentRepository => ({
  async createDeployment(input) { return { ...deployment, ...input }; },
  async listDeployments() { return []; },
  async getDeployment() { return deployment; },
  async findScheduledByWorkerId() { return []; },
  async updateStatus(_id, status) { return { ...deployment, status }; },
});

const workerRepository = (current = worker) => ({ getWorker: async () => current }) as never;

describe("deployment service", () => {
  it("requires ownership and does not invoke the scheduler", async () => {
    let commands = 0;
    const service = new DeploymentService(
      { getModel: async () => model }, repository(), workerRepository(),
      { isWorkerConnected: () => true, sendToWorker: () => { commands += 1; return true; }, requestInference: async () => ({ success: true, deploymentId: deployment.id, response: "" }) },
    );
    await expect(service.createDeployment({ modelId: model.id, workerId }, "other-user")).rejects.toBeInstanceOf(WorkerNotFoundError);
    expect(commands).toBe(0);
  });

  it("rejects offline workers and workers without an active socket", async () => {
    const service = new DeploymentService(
      { getModel: async () => model }, repository(), workerRepository({ ...worker, status: "OFFLINE" }),
      { isWorkerConnected: () => false, sendToWorker: () => true, requestInference: async () => ({ success: true, deploymentId: deployment.id, response: "" }) },
    );
    await expect(service.createDeployment({ modelId: model.id, workerId }, userId)).rejects.toBeInstanceOf(WorkerOfflineError);
  });

  it("creates a deployment and delivers the exact command without scheduling", async () => {
    let command: unknown;
    const service = new DeploymentService(
      { getModel: async () => model }, repository(), workerRepository(),
      { isWorkerConnected: () => true, sendToWorker: (_id, message) => { command = message; return true; }, requestInference: async () => ({ success: true, deploymentId: deployment.id, response: "" }) },
    );
    const created = await service.createDeployment({ modelId: model.id, workerId }, userId);
    expect(created.status).toBe("DEPLOYING");
    expect(command).toMatchObject({
      type: "deployment.command", version: 1, workerId,
      payload: { deploymentId: deployment.id, modelId: model.id, runtime: "ollama" },
    });
  });

  it("requires an owned running deployment for inference", async () => {
    const service = new DeploymentService(
      { getModel: async () => model }, repository(), workerRepository(),
      { isWorkerConnected: () => true, sendToWorker: () => true, requestInference: async () => ({ success: true, deploymentId: deployment.id, response: "OK" }) },
    );
    await expect(service.inferDeployment(deployment.id, "other-user", "Hello")).rejects.toBeInstanceOf(WorkerNotFoundError);
    await expect(service.inferDeployment(deployment.id, userId, "Hello")).rejects.toMatchObject({ code: "DEPLOYMENT_NOT_RUNNING" });
  });
});
