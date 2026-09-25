import { describe, expect, it } from "vitest";

import type { Model } from "../models/models.types.js";
import { ModelNotFoundError } from "../models/models.service.js";
import { NoCompatibleWorkerError } from "../scheduler/scheduler.service.js";
import type { SchedulableWorker } from "../scheduler/scheduler.types.js";
import type { DeploymentRepository } from "./deployments.repository.js";
import { DeploymentNotFoundError, DeploymentService } from "./deployments.service.js";
import type { Deployment } from "./deployments.types.js";
import type { DeploymentCreation } from "./deployments.validation.js";

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

const createRepository = (initial: Deployment[] = []) => {
  const deployments = [...initial];
  const repository: DeploymentRepository = {
    async createDeployment(input) {
      const created = { ...deployment, ...input };
      deployments.push(created);
      return created;
    },
    async listDeployments() {
      return deployments;
    },
    async getDeployment(deploymentId) {
      return deployments.find((entry) => entry.id === deploymentId);
    },
    async findScheduledByWorkerId(workerId) {
      return deployments.filter((entry) => entry.workerId === workerId && entry.status === "SCHEDULED");
    },
  };
  return { deployments, repository };
};

const input: DeploymentCreation = { modelId: model.id };

describe("deployment service", () => {
  it("maps model requirements into the scheduler request", async () => {
    let receivedRequirements: unknown;
    const { repository } = createRepository();
    const service = new DeploymentService(
      { getModel: async () => model },
      {
        scheduleWorkload: async (requirements) => {
          receivedRequirements = requirements;
          return worker;
        },
      },
      repository,
    );

    await service.createDeployment(input);

    expect(receivedRequirements).toEqual({
      minRamMb: 6000,
      minVramMb: 4000,
      requiresGpu: true,
    });
  });

  it("creates a SCHEDULED deployment with the selected model and worker", async () => {
    const { deployments, repository } = createRepository();
    const service = new DeploymentService(
      { getModel: async () => model },
      { scheduleWorkload: async () => worker },
      repository,
    );

    const created = await service.createDeployment(input);

    expect(created.status).toBe("SCHEDULED");
    expect(created.modelId).toBe(model.id);
    expect(created.workerId).toBe(worker.id);
    expect(deployments).toHaveLength(1);
  });

  it("propagates a missing model without scheduling or creating a deployment", async () => {
    let scheduleCalls = 0;
    const { deployments, repository } = createRepository();
    const service = new DeploymentService(
      { getModel: async () => { throw new ModelNotFoundError(); } },
      { scheduleWorkload: async () => { scheduleCalls += 1; return worker; } },
      repository,
    );

    await expect(service.createDeployment(input)).rejects.toBeInstanceOf(ModelNotFoundError);
    expect(scheduleCalls).toBe(0);
    expect(deployments).toHaveLength(0);
  });

  it("does not create a deployment when no worker is compatible", async () => {
    const { deployments, repository } = createRepository();
    const service = new DeploymentService(
      { getModel: async () => model },
      { scheduleWorkload: async () => { throw new NoCompatibleWorkerError(); } },
      repository,
    );

    await expect(service.createDeployment(input)).rejects.toBeInstanceOf(NoCompatibleWorkerError);
    expect(deployments).toHaveLength(0);
  });

  it("propagates unexpected scheduler failures", async () => {
    const { repository } = createRepository();
    const failure = new Error("scheduler unavailable");
    const service = new DeploymentService(
      { getModel: async () => model },
      { scheduleWorkload: async () => { throw failure; } },
      repository,
    );

    await expect(service.createDeployment(input)).rejects.toBe(failure);
  });

  it("lists deployments through the repository", async () => {
    const { repository } = createRepository([deployment]);
    const service = new DeploymentService({ getModel: async () => model }, { scheduleWorkload: async () => worker }, repository);

    await expect(service.listDeployments()).resolves.toEqual([deployment]);
  });

  it("gets an existing deployment", async () => {
    const { repository } = createRepository([deployment]);
    const service = new DeploymentService({ getModel: async () => model }, { scheduleWorkload: async () => worker }, repository);

    await expect(service.getDeployment(deployment.id)).resolves.toEqual(deployment);
  });

  it("returns DEPLOYMENT_NOT_FOUND for a missing deployment", async () => {
    const { repository } = createRepository();
    const service = new DeploymentService({ getModel: async () => model }, { scheduleWorkload: async () => worker }, repository);

    await expect(service.getDeployment("00000000-0000-4000-8000-000000000099")).rejects.toBeInstanceOf(
      DeploymentNotFoundError,
    );
  });
});
