import assert from "node:assert/strict";
import { describe, it } from "vitest";

import type { Worker } from "../workers/worker.repository.js";
import { NoCompatibleWorkerError, SchedulerService } from "./scheduler.service.js";
import { schedulingRequestSchema } from "./scheduler.types.js";

const createWorker = (overrides: Partial<Worker> = {}): Worker => ({
  id: "00000000-0000-0000-0000-000000000001",
  name: "worker-01",
  status: "ONLINE",
  cpuCores: 8,
  totalRamMb: 16000,
  availableRamMb: 12000,
  gpu: null,
  vramMb: null,
  architecture: "x64",
  operatingSystem: "windows",
  lastHeartbeat: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const createService = (workers: Worker[]) =>
  new SchedulerService({
    listWorkers: async () => workers,
  });

const requirements = (input: Record<string, unknown>) =>
  schedulingRequestSchema.parse(input);

describe("scheduler service", () => {
it("GPU requirement rejects CPU-only workers", async () => {
  const service = createService([createWorker()]);

  await assert.rejects(
    service.scheduleWorkload(requirements({ requiresGpu: true })),
    NoCompatibleWorkerError,
  );
});

it("allows CPU-only workers when GPU is not required", async () => {
  const worker = createWorker();
  const selected = await createService([worker]).scheduleWorkload(
    requirements({ requiresGpu: false, minCpuCores: 4 }),
  );

  assert.equal(selected.id, worker.id);
});

it("VRAM requirement rejects insufficient VRAM", async () => {
  const service = createService([createWorker({ gpu: "NVIDIA RTX 3050", vramMb: 2048 })]);

  await assert.rejects(
    service.scheduleWorkload(requirements({ minVramMb: 4096 })),
    NoCompatibleWorkerError,
  );
});

it("RAM requirement uses available RAM instead of total RAM", async () => {
  const service = createService([createWorker({ totalRamMb: 16000, availableRamMb: 3000 })]);

  await assert.rejects(
    service.scheduleWorkload(requirements({ minRamMb: 6000 })),
    NoCompatibleWorkerError,
  );
});

it("CPU requirement rejects workers with insufficient cores", async () => {
  const service = createService([createWorker({ cpuCores: 2 })]);

  await assert.rejects(
    service.scheduleWorkload(requirements({ minCpuCores: 4 })),
    NoCompatibleWorkerError,
  );
});

it("architecture requirement rejects mismatched workers", async () => {
  const service = createService([createWorker({ architecture: "arm64" })]);

  await assert.rejects(
    service.scheduleWorkload(requirements({ architecture: "x64" })),
    NoCompatibleWorkerError,
  );
});

it("operating-system requirement rejects mismatched workers", async () => {
  const service = createService([createWorker({ operatingSystem: "linux" })]);

  await assert.rejects(
    service.scheduleWorkload(requirements({ operatingSystem: "windows" })),
    NoCompatibleWorkerError,
  );
});

it("OFFLINE workers are ignored", async () => {
  const service = createService([createWorker({ status: "OFFLINE" })]);

  await assert.rejects(
    service.scheduleWorkload(requirements({ minCpuCores: 1 })),
    NoCompatibleWorkerError,
  );
});

it("BUSY workers are ignored", async () => {
  const service = createService([createWorker({ status: "BUSY" })]);

  await assert.rejects(
    service.scheduleWorkload(requirements({ minCpuCores: 1 })),
    NoCompatibleWorkerError,
  );
});

it("selects a worker satisfying all requirements", async () => {
  const worker = createWorker({
    gpu: "NVIDIA RTX 3050",
    vramMb: 4095,
    availableRamMb: 8000,
  });
  const service = createService([worker]);

  const selected = await service.scheduleWorkload(
    requirements({
      minCpuCores: 4,
      minRamMb: 6000,
      requiresGpu: true,
      minVramMb: 4000,
      architecture: "x64",
      operatingSystem: "windows",
    }),
  );

  assert.equal(selected.id, worker.id);
  assert.equal(selected.status, "ONLINE");
});

it("selects highest available RAM first", async () => {
  const selected = await createService([
    createWorker({ id: "ram-low", availableRamMb: 8000, vramMb: 8192 }),
    createWorker({ id: "ram-high", availableRamMb: 9000, vramMb: 0 }),
  ]).scheduleWorkload(requirements({ minRamMb: 4000 }));

  assert.equal(selected.id, "ram-high");
});

it("uses VRAM, then CPU, then worker ID as tie-breakers", async () => {
  const vramSelected = await createService([
    createWorker({ id: "vram-low", availableRamMb: 8000, vramMb: 2048, cpuCores: 16 }),
    createWorker({ id: "vram-high", availableRamMb: 8000, vramMb: 4096, cpuCores: 4 }),
  ]).scheduleWorkload(requirements({ minRamMb: 4000 }));
  assert.equal(vramSelected.id, "vram-high");

  const cpuSelected = await createService([
    createWorker({ id: "cpu-low", availableRamMb: 8000, vramMb: 4096, cpuCores: 4 }),
    createWorker({ id: "cpu-high", availableRamMb: 8000, vramMb: 4096, cpuCores: 8 }),
  ]).scheduleWorkload(requirements({ minRamMb: 4000 }));
  assert.equal(cpuSelected.id, "cpu-high");

  const idSelected = await createService([
    createWorker({ id: "worker-b", availableRamMb: 8000, vramMb: 4096, cpuCores: 8 }),
    createWorker({ id: "worker-a", availableRamMb: 8000, vramMb: 4096, cpuCores: 8 }),
  ]).scheduleWorkload(requirements({ minRamMb: 4000 }));
  assert.equal(idSelected.id, "worker-a");
});

it("no compatible worker returns the scheduler error", async () => {
  const service = createService([]);

  await assert.rejects(
    service.scheduleWorkload(requirements({ minCpuCores: 4 })),
    (error: unknown) =>
      error instanceof NoCompatibleWorkerError &&
      error.code === "NO_COMPATIBLE_WORKER" &&
      error.message === "No online worker satisfies the requested resources.",
  );
});

it("missing or invalid requirements are rejected", () => {
  assert.equal(schedulingRequestSchema.safeParse({}).success, false);
  assert.equal(schedulingRequestSchema.safeParse({ minCpuCores: 0 }).success, false);
  assert.equal(schedulingRequestSchema.safeParse({ minRamMb: -1 }).success, false);
  assert.equal(schedulingRequestSchema.safeParse({ minVramMb: -1 }).success, false);
  assert.equal(schedulingRequestSchema.safeParse({ requiresGpu: "yes" }).success, false);
});
});
