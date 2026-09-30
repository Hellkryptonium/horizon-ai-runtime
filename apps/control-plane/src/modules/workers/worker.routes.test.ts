import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import type { NewWorker, Worker, WorkerRepository } from "./worker.repository.js";
import type { WorkerEnrollmentRepository } from "./enrollment.repository.js";
import { hashWorkerEnrollmentToken } from "./enrollment.service.js";
import type { AuthService } from "../auth/auth.service.js";
import { WorkerService } from "./worker.service.js";

const userA = "00000000-0000-4000-8000-000000000010";
const userB = "00000000-0000-4000-8000-000000000011";

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
  userId: null,
  credentialHash: null,
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
  revokedAt: null,
  ...overrides,
});

const createFakeRepository = (initialWorkers: Worker[] = []): WorkerRepository => {
  const workers = [...initialWorkers];

  return {
    async createWorker(input: NewWorker) {
      const worker: Worker = {
        id: input.id ?? "00000000-0000-0000-0000-000000000001",
        name: input.name,
        credentialHash: input.credentialHash ?? null,
        status: input.status ?? "OFFLINE",
        cpuCores: input.cpuCores,
        totalRamMb: input.totalRamMb,
        availableRamMb: input.availableRamMb,
        gpu: input.gpu ?? null,
        vramMb: input.vramMb ?? null,
        architecture: input.architecture ?? null,
        operatingSystem: input.operatingSystem,
        userId: input.userId ?? null,
        lastHeartbeat: input.lastHeartbeat ?? null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        revokedAt: null,
      };
      workers.push(worker);
      return worker;
    },
    async getWorker(workerId) {
      return workers.find((worker) => worker.id === workerId);
    },
    async getWorkerByCredentialHash(credentialHash) {
      return workers.find((worker) => worker.credentialHash === credentialHash);
    },
    async listWorkers() {
      return workers;
    },
    async listWorkersForUser(userId) {
      return workers.filter((worker) => worker.userId === userId);
    },
    async updateWorkerForEnrollment(workerId, userId, credentialHash, input) {
      const worker = workers.find((candidate) => candidate.id === workerId);
      if (!worker || (worker.userId !== null && worker.userId !== userId)) {
        throw new Error("worker ownership conflict");
      }
      Object.assign(worker, { ...input, userId, credentialHash, status: "ONLINE", lastHeartbeat: new Date(), updatedAt: new Date() });
      return worker;
    },
    async updateConnectionStatus(workerId, status) {
      const worker = workers.find((candidate) => candidate.id === workerId);
      if (!worker) return undefined;
      worker.status = status;
      return worker;
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

const createFakeAuth = (userId = userA) => ({
  async getUserForToken(token: string) {
    return token ? { id: userId, name: "Test user", email: `${userId}@example.com` } : undefined;
  },
}) as AuthService;

const createFakeEnrollmentRepository = (): WorkerEnrollmentRepository => {
  const enrollments = new Map<string, {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  }>();

  return {
    async createEnrollment(input) {
      const enrollment = {
        id: input.id!,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        usedAt: null,
        createdAt: new Date(),
      };
      enrollments.set(enrollment.tokenHash, enrollment);
      return enrollment;
    },
    async peekEnrollment(tokenHash, now) {
      const enrollment = enrollments.get(tokenHash);
      return enrollment && !enrollment.usedAt && enrollment.expiresAt > now ? enrollment : undefined;
    },
    async consumeEnrollment(tokenHash, now) {
      const enrollment = enrollments.get(tokenHash);
      if (!enrollment || enrollment.usedAt || enrollment.expiresAt <= now) return undefined;
      enrollment.usedAt = now;
      return enrollment;
    },
  };
};

const createAuthenticatedApp = (
  repository: WorkerRepository,
  userId = userA,
  enrollments = createFakeEnrollmentRepository(),
) => createApp(repository, undefined, undefined, undefined, createFakeAuth(userId), enrollments);

describe("worker routes", () => {
  it("requires authentication for enrollment creation and worker listing", async () => {
    const app = createApp(createFakeRepository(), undefined, undefined, undefined, createFakeAuth());
    expect((await request(app).post("/api/workers/enrollment")).status).toBe(401);
    expect((await request(app).get("/api/workers")).status).toBe(401);
  });

  it("generates and consumes a one-time enrollment token", async () => {
    const app = createAuthenticatedApp(createFakeRepository());
    const tokenResponse = await request(app).post("/api/workers/enrollment").set("Cookie", "horizon_session=session");
    const token = tokenResponse.body.token as string;

    expect(tokenResponse.status).toBe(201);
    expect(token).toMatch(/^hzn_enroll_/);
    expect(tokenResponse.body.expiresAt).toBeTruthy();
    expect(hashWorkerEnrollmentToken(token)).not.toBe(token);

    const enrolled = await request(app).post("/api/workers/enroll").send({ ...registrationPayload, token });
    expect(enrolled.status).toBe(201);
    expect(enrolled.body.worker.userId).toBe(userA);

    const reused = await request(app).post("/api/workers/enroll").send({ ...registrationPayload, token });
    expect(reused.status).toBe(401);
  });

  it("rejects an invalid cpuCores value", async () => {
    const response = await request(createAuthenticatedApp(createFakeRepository()))
      .post("/api/workers/enroll")
      .send({ ...registrationPayload, token: "token", cpuCores: 0 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("rejects available RAM greater than total RAM", async () => {
    const response = await request(createAuthenticatedApp(createFakeRepository()))
      .post("/api/workers/enroll")
      .send({ ...registrationPayload, token: "token", availableRamMb: 20000 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("rejects malformed JSON", async () => {
    const response = await request(createApp(createFakeRepository()))
      .post("/api/workers/enroll")
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
    const worker = createWorkerRecord({ ...registrationPayload, userId: userA });

    const response = await request(createAuthenticatedApp(createFakeRepository([worker]))).get("/api/workers").set("Cookie", "horizon_session=session");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, workers: [expect.objectContaining({ id: worker.id })] });
  });

  it("only lists workers owned by the authenticated user", async () => {
    const workers = [
      createWorkerRecord({ userId: userA }),
      createWorkerRecord({ id: "00000000-0000-0000-0000-000000000002", userId: userB }),
    ];

    const response = await request(createAuthenticatedApp(createFakeRepository(workers), userA))
      .get("/api/workers")
      .set("Cookie", "horizon_session=session");

    expect(response.status).toBe(200);
    expect(response.body.workers).toHaveLength(1);
    expect(response.body.workers[0].userId).toBe(userA);
  });
});