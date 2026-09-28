import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "../../db/index.js";
import { workerEnrollments } from "../../db/schema.js";

export type WorkerEnrollment = typeof workerEnrollments.$inferSelect;
export type NewWorkerEnrollment = typeof workerEnrollments.$inferInsert;

export interface WorkerEnrollmentRepository {
  createEnrollment(enrollment: NewWorkerEnrollment): Promise<WorkerEnrollment>;
  peekEnrollment(tokenHash: string, now: Date): Promise<WorkerEnrollment | undefined>;
  consumeEnrollment(tokenHash: string, now: Date): Promise<WorkerEnrollment | undefined>;
}

export const workerEnrollmentRepository: WorkerEnrollmentRepository = {
  async createEnrollment(enrollment) {
    const [created] = await db.insert(workerEnrollments).values(enrollment).returning();

    if (!created) {
      throw new Error("Worker enrollment insert did not return an enrollment");
    }

    return created;
  },

  async peekEnrollment(tokenHash, now) {
    const [enrollment] = await db
      .select()
      .from(workerEnrollments)
      .where(
        and(
          eq(workerEnrollments.tokenHash, tokenHash),
          isNull(workerEnrollments.usedAt),
          gt(workerEnrollments.expiresAt, now),
        ),
      );

    return enrollment;
  },

  async consumeEnrollment(tokenHash, now) {
    const [consumed] = await db
      .update(workerEnrollments)
      .set({ usedAt: now })
      .where(
        and(
          eq(workerEnrollments.tokenHash, tokenHash),
          isNull(workerEnrollments.usedAt),
          gt(workerEnrollments.expiresAt, now),
        ),
      )
      .returning();

    return consumed;
  },
};
