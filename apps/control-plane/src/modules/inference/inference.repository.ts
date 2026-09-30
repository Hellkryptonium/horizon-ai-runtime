import { desc, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { inferenceRequests, inferenceUsage } from "../../db/schema.js";

export type NewInferenceRequest = typeof inferenceRequests.$inferInsert;

export const inferenceRepository = {
	listForUser(userId: string, deploymentId?: string) {
		return db.select().from(inferenceRequests).where(deploymentId ? eq(inferenceRequests.deploymentId, deploymentId) : eq(inferenceRequests.userId, userId)).orderBy(desc(inferenceRequests.queuedAt)).limit(100);
	},
	listUsageForUser(userId: string) {
		return db.select({ usage: inferenceUsage, request: inferenceRequests }).from(inferenceUsage).innerJoin(inferenceRequests, eq(inferenceUsage.requestId, inferenceRequests.id)).where(eq(inferenceRequests.userId, userId)).orderBy(desc(inferenceUsage.createdAt)).limit(100);
	},
	create(input: NewInferenceRequest) {
		return db.insert(inferenceRequests).values(input).returning().then(([request]) => {
			if (!request) throw new Error("Inference request insert did not return a request");
			return request;
		});
	},
	markRunning(id: string) {
		return db.update(inferenceRequests).set({ status: "RUNNING", startedAt: new Date(), attempts: 1 }).where(eq(inferenceRequests.id, id));
	},
	succeed(id: string, response: string) {
		return db.update(inferenceRequests).set({ status: "SUCCEEDED", response, completedAt: new Date() }).where(eq(inferenceRequests.id, id));
	},
	fail(id: string, error: string, timedOut = false) {
		return db.update(inferenceRequests).set({ status: timedOut ? "TIMED_OUT" : "FAILED", error, completedAt: new Date() }).where(eq(inferenceRequests.id, id));
	},
	recordUsage(requestId: string, promptTokens: number, completionTokens: number, latencyMs: number) {
		return db.insert(inferenceUsage).values({ requestId, promptTokens, completionTokens, latencyMs });
	},
};