import { and, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";

import { db } from "../../db/index.js";
import { workers } from "../../db/schema.js";

export type Worker = typeof workers.$inferSelect;
export type NewWorker = typeof workers.$inferInsert;

export interface WorkerHeartbeatUpdate {
  availableRamMb: number;
  gpu?: string | null;
  vramMb?: number | null;
}

export interface WorkerRepository {
  createWorker(worker: NewWorker): Promise<Worker>;
  getWorker(workerId: string): Promise<Worker | undefined>;
  getWorkerByCredentialHash(credentialHash: string): Promise<Worker | undefined>;
  listWorkers(): Promise<Worker[]>;
  listWorkersForUser(userId: string): Promise<Worker[]>;
  updateWorkerForEnrollment(workerId: string, userId: string, credentialHash: string, worker: NewWorker): Promise<Worker>;
  updateConnectionStatus(workerId: string, status: "ONLINE" | "OFFLINE"): Promise<Worker | undefined>;
  updateHeartbeat(workerId: string, update: WorkerHeartbeatUpdate): Promise<Worker | undefined>;
  markStaleWorkers(cutoff: Date): Promise<Worker[]>;
}

export const workerRepository: WorkerRepository = {
  async createWorker(worker) {
    const [createdWorker] = await db.insert(workers).values(worker).returning();

    if (!createdWorker) {
      throw new Error("Worker insert did not return a worker");
    }

    return createdWorker;
  },

  async getWorker(workerId) {
    const [worker] = await db.select().from(workers).where(eq(workers.id, workerId));
    return worker;
  },

  async getWorkerByCredentialHash(credentialHash) {
    const [worker] = await db.select().from(workers).where(eq(workers.credentialHash, credentialHash));
    return worker;
  },

  async listWorkers() {
    return db.select().from(workers);
  },

  async listWorkersForUser(userId) {
    return db.select().from(workers).where(eq(workers.userId, userId));
  },

  async updateWorkerForEnrollment(workerId, userId, credentialHash, worker) {
    const [updatedWorker] = await db
      .update(workers)
      .set({
        userId,
        credentialHash,
        name: worker.name,
        cpuCores: worker.cpuCores,
        totalRamMb: worker.totalRamMb,
        availableRamMb: worker.availableRamMb,
        gpu: worker.gpu ?? null,
        vramMb: worker.vramMb ?? null,
        architecture: worker.architecture ?? null,
        operatingSystem: worker.operatingSystem,
        status: "ONLINE",
        lastHeartbeat: worker.lastHeartbeat ?? new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(workers.id, workerId), or(eq(workers.userId, userId), isNull(workers.userId))))
      .returning();

    if (!updatedWorker) {
      throw new Error("Worker enrollment update did not return a worker");
    }

    return updatedWorker;
  },

  async updateConnectionStatus(workerId, status) {
    const [updatedWorker] = await db
      .update(workers)
      .set({ status, updatedAt: new Date() })
      .where(eq(workers.id, workerId))
      .returning();

    return updatedWorker;
  },

  async updateHeartbeat(workerId, update) {
    const [updatedWorker] = await db
      .update(workers)
      .set({
        status: "ONLINE",
        availableRamMb: update.availableRamMb,
        ...(update.gpu !== undefined ? { gpu: update.gpu } : {}),
        ...(update.vramMb !== undefined ? { vramMb: update.vramMb } : {}),
        lastHeartbeat: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workers.id, workerId))
      .returning();

    return updatedWorker;
  },

  async markStaleWorkers(cutoff) {
    return db
      .update(workers)
      .set({ status: "OFFLINE", updatedAt: new Date() })
      .where(
        and(
          inArray(workers.status, ["ONLINE", "BUSY"]),
          isNotNull(workers.lastHeartbeat),
          lt(workers.lastHeartbeat, cutoff),
        ),
      )
      .returning();
  },
};