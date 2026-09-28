import { describe, expect, it } from "vitest";

import type { WorkerEnrollmentRepository } from "./enrollment.repository.js";
import {
  hashWorkerEnrollmentToken,
  InvalidWorkerEnrollmentError,
  WorkerEnrollmentService,
  WorkerOwnershipError,
} from "./enrollment.service.js";
import type { Worker, WorkerRepository } from "./worker.repository.js";
import type { WorkerRegistration } from "./worker.service.js";

const userA = "00000000-0000-4000-8000-000000000010";
const userB = "00000000-0000-4000-8000-000000000011";
const workerId = "00000000-0000-4000-8000-000000000020";
const registration: WorkerRegistration = {
  id: workerId,
  name: "laptop",
  cpuCores: 8,
  totalRamMb: 16000,
  availableRamMb: 12000,
  gpu: null,
  vramMb: null,
  architecture: "x64",
  operatingSystem: "windows",
};

const createWorker = (userId: string | null = null): Worker => ({
  id: workerId,
  userId,
  credentialHash: null,
  name: registration.name,
  status: "OFFLINE",
  cpuCores: registration.cpuCores,
  totalRamMb: registration.totalRamMb,
  availableRamMb: registration.availableRamMb,
  gpu: null,
  vramMb: null,
  architecture: registration.architecture,
  operatingSystem: registration.operatingSystem,
  lastHeartbeat: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createHarness = (existingWorker?: Worker) => {
  const stored = new Map<string, { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null; createdAt: Date }>();
  const workers = existingWorker ? [existingWorker] : [];
  const enrollments: WorkerEnrollmentRepository = {
    async createEnrollment(input) {
      const enrollment = { id: input.id!, userId: input.userId, tokenHash: input.tokenHash, expiresAt: input.expiresAt, usedAt: null, createdAt: new Date() };
      stored.set(enrollment.tokenHash, enrollment);
      return enrollment;
    },
    async peekEnrollment(tokenHash, now) {
      const enrollment = stored.get(tokenHash);
      return enrollment && !enrollment.usedAt && enrollment.expiresAt > now ? enrollment : undefined;
    },
    async consumeEnrollment(tokenHash, now) {
      const enrollment = stored.get(tokenHash);
      if (!enrollment || enrollment.usedAt || enrollment.expiresAt <= now) return undefined;
      enrollment.usedAt = now;
      return enrollment;
    },
  };
  const repository: WorkerRepository = {
    async createWorker(input) {
      const worker = { ...createWorker(input.userId ?? null), ...input, id: input.id ?? workerId, status: input.status ?? "OFFLINE", gpu: input.gpu ?? null, vramMb: input.vramMb ?? null, architecture: input.architecture ?? null, lastHeartbeat: input.lastHeartbeat ?? null, createdAt: new Date(), updatedAt: new Date() } as Worker;
      workers.push(worker);
      return worker;
    },
    async getWorker(id) { return workers.find((worker) => worker.id === id); },
    async getWorkerByCredentialHash() { return undefined; },
    async listWorkers() { return workers; },
    async listWorkersForUser(userId) { return workers.filter((worker) => worker.userId === userId); },
    async updateWorkerForEnrollment(id, userId, credentialHash, input) {
      const worker = workers.find((candidate) => candidate.id === id)!;
      Object.assign(worker, input, { userId, credentialHash, status: "ONLINE" });
      return worker;
    },
    async updateConnectionStatus() { return undefined; },
    async updateHeartbeat() { return undefined; },
    async markStaleWorkers() { return []; },
  };
  return { service: new WorkerEnrollmentService(enrollments, repository), stored };
};

describe("WorkerEnrollmentService", () => {
  it("hashes tokens and sets a fifteen minute expiry", async () => {
    const { service, stored } = createHarness();
    const now = new Date("2026-01-01T00:00:00.000Z");
    const result = await service.createEnrollment(userA, now);
    const saved = [...stored.values()][0];

    expect(saved.tokenHash).toBe(hashWorkerEnrollmentToken(result.token));
    expect(saved.tokenHash).not.toBe(result.token);
    expect(result.expiresAt).toEqual(new Date("2026-01-01T00:15:00.000Z"));
  });

  it("rejects expired tokens", async () => {
    const { service } = createHarness();
    const result = await service.createEnrollment(userA, new Date("2026-01-01T00:00:00.000Z"));

    await expect(service.enrollWorker(result.token, registration, new Date("2026-01-01T00:15:00.000Z"))).rejects.toBeInstanceOf(InvalidWorkerEnrollmentError);
  });

  it("rejects a token from claiming another user's worker", async () => {
    const { service } = createHarness(createWorker(userB));
    const result = await service.createEnrollment(userA);

    await expect(service.enrollWorker(result.token, registration)).rejects.toBeInstanceOf(WorkerOwnershipError);
  });

  it("does not consume a token when ownership conflicts", async () => {
    const { service } = createHarness(createWorker(userB));
    const result = await service.createEnrollment(userA);

    await expect(service.enrollWorker(result.token, registration)).rejects.toBeInstanceOf(WorkerOwnershipError);
    await expect(service.enrollWorker(result.token, registration)).rejects.toBeInstanceOf(WorkerOwnershipError);
  });

  it("allows only one concurrent token consumer", async () => {
    const { service } = createHarness();
    const result = await service.createEnrollment(userA);
    const attempts = await Promise.allSettled([
      service.enrollWorker(result.token, registration),
      service.enrollWorker(result.token, registration),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
  });
});
