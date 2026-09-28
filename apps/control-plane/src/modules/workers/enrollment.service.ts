import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { WorkerEnrollmentRepository } from "./enrollment.repository.js";
import type { Worker, WorkerRepository } from "./worker.repository.js";
import type { WorkerRegistration } from "./worker.service.js";

export const WORKER_ENROLLMENT_TTL_MS = 15 * 60 * 1000;

export class InvalidWorkerEnrollmentError extends Error {
  readonly code = "INVALID_WORKER_ENROLLMENT";
}

export class WorkerOwnershipError extends Error {
  readonly code = "WORKER_OWNERSHIP_CONFLICT";
}

export const hashWorkerEnrollmentToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const hashWorkerCredential = (credential: string) => createHash("sha256").update(credential).digest("hex");

export type EnrolledWorker = Worker & { credential: string };

export class WorkerEnrollmentService {
  constructor(
    private readonly enrollments: WorkerEnrollmentRepository,
    private readonly workers: WorkerRepository,
  ) {}

  async createEnrollment(userId: string, now = new Date()) {
    const token = `hzn_enroll_${randomBytes(32).toString("base64url")}`;
    const expiresAt = new Date(now.getTime() + WORKER_ENROLLMENT_TTL_MS);

    await this.enrollments.createEnrollment({
      id: randomUUID(),
      userId,
      tokenHash: hashWorkerEnrollmentToken(token),
      expiresAt,
    });

    return { token, expiresAt };
  }

  async enrollWorker(token: string, input: WorkerRegistration, now = new Date()): Promise<EnrolledWorker> {
    const workerId = input.id;
    const existingWorker = workerId ? await this.workers.getWorker(workerId) : undefined;

    if (existingWorker && existingWorker.userId !== null) {
      const enrollment = await this.enrollments.peekEnrollment(hashWorkerEnrollmentToken(token), now);

      if (enrollment && existingWorker.userId !== enrollment.userId) {
        throw new WorkerOwnershipError();
      }
    }

    const enrollment = await this.enrollments.consumeEnrollment(hashWorkerEnrollmentToken(token), now);

    if (!enrollment) {
      throw new InvalidWorkerEnrollmentError();
    }

    if (existingWorker && existingWorker.userId !== null && existingWorker.userId !== enrollment.userId) {
      throw new WorkerOwnershipError();
    }

    const credential = `hzn_worker_${randomBytes(32).toString("base64url")}`;

    if (existingWorker && workerId) {
      const worker = await this.workers.updateWorkerForEnrollment(workerId, enrollment.userId, hashWorkerCredential(credential), input);
      return { ...worker, credential };
    }

    const worker = await this.workers.createWorker({
      ...input,
      id: workerId,
      userId: enrollment.userId,
      credentialHash: hashWorkerCredential(credential),
      gpu: input.gpu ?? null,
      vramMb: input.vramMb ?? null,
      status: "ONLINE",
      lastHeartbeat: now,
    });

    return { ...worker, credential };
  }
}
