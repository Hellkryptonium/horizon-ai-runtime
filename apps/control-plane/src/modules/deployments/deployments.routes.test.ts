import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import type { Model } from "../models/models.types.js";
import type { ModelRepository } from "../models/models.repository.js";
import { NoCompatibleWorkerError } from "../scheduler/scheduler.service.js";
import type { SchedulableWorker } from "../scheduler/scheduler.types.js";
import type { Deployment } from "./deployments.types.js";
import type { DeploymentRepository } from "./deployments.repository.js";
import type { WorkerRepository } from "../workers/worker.repository.js";

const model: Model = {
  id: "5637017b-585d-4a5c-82be-41acd0002571",
  name: "DeepSeek 7B",
  version: "1.0",
  format: "GGUF",
  runtime: "llama.cpp",
  runtimeModelId: null,
  sizeMb: 4500,
  minRamMb: 6000,
  minVramMb: 4000,
  requiresGpu: true,
  modelArchitecture: "llama",
  contextLength: 4096,
  downloadUrl: "https://example.com/model.gguf",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const worker: SchedulableWorker = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "gpu-worker",
  status: "ONLINE",
  cpuCores: 12,
  availableRamMb: 8000,
  gpu: "NVIDIA RTX 3050",
  vramMb: 4095,
  architecture: "x64",
  operatingSystem: "windows",
};

const deployment: Deployment = {
  id: "00000000-0000-4000-8000-000000000002",
  modelId: model.id,
  workerId: worker.id,
  status: "SCHEDULED",
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const createModelRepository = (existingModel?: Model): ModelRepository => ({
  async createModel() { return existingModel ?? model; },
  async listModels() { return existingModel ? [existingModel] : []; },
  async getModel(modelId) { return existingModel?.id === modelId ? existingModel : undefined; },
});

const createDeploymentRepository = (existingDeployments: Deployment[] = []): DeploymentRepository => {
  const deployments = [...existingDeployments];
  return {
    async createDeployment(input) {
      const created = { ...deployment, ...input };
      deployments.push(created);
      return created;
    },
    async listDeployments() { return deployments; },
    async getDeployment(deploymentId) { return deployments.find((entry) => entry.id === deploymentId); },
    async findScheduledByWorkerId(workerId) {
      return deployments.filter((entry) => entry.workerId === workerId && entry.status === "SCHEDULED");
    },
  };
};

const createWorkerRepository = (workerIds: string[]): WorkerRepository => ({
  async createWorker() { throw new Error("not used"); },
  async getWorker(workerId) {
    return workerIds.includes(workerId) ? ({ id: workerId } as never) : undefined;
  },
  async listWorkers() { return []; },
  async updateHeartbeat() { return undefined; },
  async markStaleWorkers() { return []; },
});

describe("deployment routes", () => {
  it("creates a scheduled deployment", async () => {
    const response = await request(
      createApp(
        undefined,
        createModelRepository(model),
        { scheduleWorkload: async () => worker },
        createDeploymentRepository(),
      ),
    )
      .post("/api/deployments")
      .send({ modelId: model.id });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      deployment: expect.objectContaining({
        modelId: model.id,
        workerId: worker.id,
        status: "SCHEDULED",
      }),
    });
  });

  it("rejects an invalid deployment body with 400", async () => {
    const response = await request(
      createApp(undefined, createModelRepository(model), { scheduleWorkload: async () => worker }, createDeploymentRepository()),
    )
      .post("/api/deployments")
      .send({ modelId: "not-a-uuid" });

    expect(response.status).toBe(400);
  });

  it("returns 404 when the model does not exist", async () => {
    const response = await request(
      createApp(undefined, createModelRepository(), { scheduleWorkload: async () => worker }, createDeploymentRepository()),
    )
      .post("/api/deployments")
      .send({ modelId: model.id });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("MODEL_NOT_FOUND");
  });

  it("returns 409 when the scheduler finds no compatible worker", async () => {
    const response = await request(
      createApp(
        undefined,
        createModelRepository(model),
        { scheduleWorkload: async () => { throw new NoCompatibleWorkerError(); } },
        createDeploymentRepository(),
      ),
    )
      .post("/api/deployments")
      .send({ modelId: model.id });

    expect(response.status).toBe(409);
  });

  it("lists and gets deployments", async () => {
    const repository = createDeploymentRepository([deployment]);
    const app = createApp(undefined, createModelRepository(model), { scheduleWorkload: async () => worker }, repository);

    const listResponse = await request(app).get("/api/deployments");
    const getResponse = await request(app).get(`/api/deployments/${deployment.id}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({ success: true, deployments: [expect.objectContaining({ id: deployment.id })] });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual({ success: true, deployment: expect.objectContaining({ id: deployment.id }) });
  });

  it("returns 404 for a missing deployment", async () => {
    const response = await request(
      createApp(undefined, createModelRepository(model), { scheduleWorkload: async () => worker }, createDeploymentRepository()),
    ).get("/api/deployments/00000000-0000-4000-8000-000000000099");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("DEPLOYMENT_NOT_FOUND");
  });

  it("returns only scheduled deployments assigned to the requesting worker", async () => {
    const otherWorkerId = "00000000-0000-4000-8000-000000000003";
    const otherDeployment = { ...deployment, id: otherWorkerId, workerId: otherWorkerId };
    const repository = createDeploymentRepository([deployment, otherDeployment]);
    const app = createApp(
      createWorkerRepository([worker.id, otherWorkerId]),
      createModelRepository(model),
      { scheduleWorkload: async () => worker },
      repository,
    );

    const response = await request(app).get(`/api/workers/${worker.id}/deployments/pending`);

    expect(response.status).toBe(200);
    expect(response.body.deployments).toEqual([
      expect.objectContaining({
        deploymentId: deployment.id,
        modelId: deployment.modelId,
        workerId: worker.id,
        status: "SCHEDULED",
        modelName: model.name,
        runtime: model.runtime,
      }),
    ]);
  });

  it("excludes non-scheduled deployments", async () => {
    const nonScheduled = { ...deployment, status: "RUNNING" as const };
    const response = await request(createApp(
      createWorkerRepository([worker.id]),
      createModelRepository(model),
      { scheduleWorkload: async () => worker },
      createDeploymentRepository([nonScheduled]),
    )).get(`/api/workers/${worker.id}/deployments/pending`);

    expect(response.body.deployments).toEqual([]);
  });

  it("rejects unknown workers", async () => {
    const response = await request(createApp(
      createWorkerRepository([]),
      createModelRepository(model),
      { scheduleWorkload: async () => worker },
      createDeploymentRepository(),
    )).get(`/api/workers/${worker.id}/deployments/pending`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKER_NOT_FOUND");
  });

  it("acknowledges a scheduled deployment idempotently", async () => {
    const app = createApp(
      createWorkerRepository([worker.id]),
      createModelRepository(model),
      { scheduleWorkload: async () => worker },
      createDeploymentRepository([deployment]),
    );

    const first = await request(app)
      .post(`/api/workers/${worker.id}/deployments/${deployment.id}/ack`)
      .send({ accepted: true });
    const second = await request(app)
      .post(`/api/workers/${worker.id}/deployments/${deployment.id}/ack`)
      .send({ accepted: true });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ success: true });
  });

  it("rejects acknowledgements for missing, mismatched, and non-scheduled deployments", async () => {
    const otherWorkerId = "00000000-0000-4000-8000-000000000003";
    const nonScheduled = { ...deployment, id: otherWorkerId, status: "RUNNING" as const };
    const app = createApp(
      createWorkerRepository([worker.id, otherWorkerId]),
      createModelRepository(model),
      { scheduleWorkload: async () => worker },
      createDeploymentRepository([deployment, nonScheduled]),
    );

    const missing = await request(app)
      .post(`/api/workers/${worker.id}/deployments/00000000-0000-4000-8000-000000000099/ack`)
      .send({ accepted: true });
    const mismatched = await request(app)
      .post(`/api/workers/${otherWorkerId}/deployments/${deployment.id}/ack`)
      .send({ accepted: true });
    const notScheduled = await request(app)
      .post(`/api/workers/${worker.id}/deployments/${nonScheduled.id}/ack`)
      .send({ accepted: true });

    expect(missing.status).toBe(404);
    expect(mismatched.status).toBe(403);
    expect(notScheduled.status).toBe(409);
  });
});
