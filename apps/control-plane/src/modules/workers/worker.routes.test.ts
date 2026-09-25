import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import type { NewWorker, Worker, WorkerRepository } from "./worker.repository.js";
import { WorkerService } from "./worker.service.js";

const registrationPayload = {
  name: "mac-01",
  cpuCores: 10,
  totalRamMb: 16384,
  availableRamMb: 12000,
  gpu: "Apple Silicon",
  vramMb: null,
  architecture: "arm64",
  operatingSystem: "macos",
};

const createWorkerRecord = (overrides: Partial<Worker> = {}): Worker => ({
  id: "00000000-0000-0000-0000-000000000001",
  name: "mac-01",
  status: "ONLINE",
  cpuCores: 10,
  totalRamMb: 16384,
  availableRamMb: 12000,
  gpu: "Apple Silicon",
  vramMb: null,
  architecture: "arm64",
  operatingSystem: "macos",
  lastHeartbeat: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const createFakeRepository = (initialWorkers: Worker[] = []): WorkerRepository => {
  const workers = [...initialWorkers];

  return {
    async createWorker(input: NewWorker) {
      const worker: Worker = {
        id: input.id ?? "00000000-0000-0000-0000-000000000001",
        name: input.name,
        status: input.status ?? "OFFLINE",
        cpuCores: input.cpuCores,
        totalRamMb: input.totalRamMb,
        availableRamMb: input.availableRamMb,
        gpu: input.gpu ?? null,
        vramMb: input.vramMb ?? null,
        architecture: input.architecture ?? null,
        operatingSystem: input.operatingSystem,
        lastHeartbeat: input.lastHeartbeat ?? null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      };
      workers.push(worker);
      return worker;
    },
    async getWorker(workerId) {
      return workers.find((worker) => worker.id === workerId);
    },
    async listWorkers() {
      return workers;
    },
    async updateHeartbeat(workerId, update) {
      const worker = workers.find((candidate) => candidate.id === workerId);

      if (!worker) {
        return undefined;
      }

      worker.status = "ONLINE";
      worker.availableRamMb = update.availableRamMb;
      if (update.gpu !== undefined) worker.gpu = update.gpu;
      if (update.vramMb !== undefined) worker.vramMb = update.vramMb;
      worker.lastHeartbeat = new Date();
      worker.updatedAt = new Date();
      return worker;
    },
    async markStaleWorkers(cutoff) {
      const staleWorkers = workers.filter(
        (worker) =>
          (worker.status === "ONLINE" || worker.status === "BUSY") &&
          worker.lastHeartbeat !== null &&
          worker.lastHeartbeat < cutoff,
      );

      for (const worker of staleWorkers) {
        worker.status = "OFFLINE";
        worker.updatedAt = new Date();
      }

      return staleWorkers;
    },
  };
};

describe("worker routes", () => {
  it("registers a worker", async () => {
    const response = await request(createApp(createFakeRepository()))
      .post("/api/workers/register")
      .send(registrationPayload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.worker).toMatchObject({
      id: "00000000-0000-0000-0000-000000000001",
      name: "mac-01",
      status: "ONLINE",
    });
  });

  it("rejects an invalid cpuCores value", async () => {
    const response = await request(createApp(createFakeRepository()))
      .post("/api/workers/register")
      .send({ ...registrationPayload, cpuCores: 0 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("rejects available RAM greater than total RAM", async () => {
    const response = await request(createApp(createFakeRepository()))
      .post("/api/workers/register")
      .send({ ...registrationPayload, availableRamMb: 20000 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("rejects malformed JSON", async () => {
    const response = await request(createApp(createFakeRepository()))
      .post("/api/workers/register")
      .set("Content-Type", "application/json")
      .send('{"name":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "Invalid JSON request body",
    });
  });

  it("updates a worker heartbeat", async () => {
    const worker = createWorkerRecord({ status: "OFFLINE" });
    const repository = createFakeRepository([worker]);
    const response = await request(createApp(repository))
      .post(`/api/workers/${worker.id}/heartbeat`)
      .send({ availableRamMb: 4505, gpu: "NVIDIA GeForce RTX 3050 Laptop GPU", vramMb: 4095 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, workerId: worker.id, status: "ONLINE" });
    expect(worker.status).toBe("ONLINE");
    expect(worker.availableRamMb).toBe(4505);
    expect(worker.gpu).toBe("NVIDIA GeForce RTX 3050 Laptop GPU");
    expect(worker.vramMb).toBe(4095);
  });

  it("updates lastHeartbeat during a heartbeat", async () => {
    const worker = createWorkerRecord();
    const previousHeartbeat = worker.lastHeartbeat;

    await request(createApp(createFakeRepository([worker])))
      .post(`/api/workers/${worker.id}/heartbeat`)
      .send({ availableRamMb: 4505 });

    expect(worker.lastHeartbeat).not.toEqual(previousHeartbeat);
  });

  it("rejects a heartbeat for an unknown worker", async () => {
    const response = await request(createApp(createFakeRepository()))
      .post("/api/workers/00000000-0000-0000-0000-000000000099/heartbeat")
      .send({ availableRamMb: 4505 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, error: "Worker not found" });
  });

  it("rejects an invalid heartbeat payload", async () => {
    const response = await request(createApp(createFakeRepository()))
      .post("/api/workers/00000000-0000-0000-0000-000000000001/heartbeat")
      .send({ availableRamMb: -1 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("marks stale workers offline", async () => {
    const worker = createWorkerRecord({
      lastHeartbeat: new Date("2026-01-01T00:00:00.000Z"),
      status: "ONLINE",
    });
    const service = new WorkerService(createFakeRepository([worker]));

    const staleWorkers = await service.markStaleWorkers(new Date("2026-01-01T00:01:00.000Z"), 30_000);

    expect(staleWorkers).toHaveLength(1);
    expect(worker.status).toBe("OFFLINE");
  });

  it("lists registered workers", async () => {
    const worker = createWorkerRecord(registrationPayload);

    const response = await request(createApp(createFakeRepository([worker]))).get("/api/workers");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, workers: [expect.objectContaining({ id: worker.id })] });
  });
});