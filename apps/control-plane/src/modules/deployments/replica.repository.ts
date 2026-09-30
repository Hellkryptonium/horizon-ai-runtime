import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "../../db/index.js";
import { deploymentReplicas } from "../../db/schema.js";

export type DeploymentReplica = typeof deploymentReplicas.$inferSelect;

export const replicaRepository = {
	create(deploymentId: string, workerId: string, maxConcurrency = 1) {
		return db.insert(deploymentReplicas).values({ deploymentId, workerId, maxConcurrency }).returning().then(([replica]) => replica);
	},
	listForDeployment(deploymentId: string) {
		return db.select().from(deploymentReplicas).where(eq(deploymentReplicas.deploymentId, deploymentId)).orderBy(asc(deploymentReplicas.activeRequests));
	},
	claim(workerId: string, deploymentId: string) {
		return db.update(deploymentReplicas)
			.set({ activeRequests: sql`${deploymentReplicas.activeRequests} + 1`, updatedAt: new Date() })
			.where(and(eq(deploymentReplicas.workerId, workerId), eq(deploymentReplicas.deploymentId, deploymentId), sql`${deploymentReplicas.activeRequests} < ${deploymentReplicas.maxConcurrency}`))
			.returning();
	},
	release(workerId: string, deploymentId: string) {
		return db.update(deploymentReplicas).set({ activeRequests: sql`greatest(${deploymentReplicas.activeRequests} - 1, 0)`, updatedAt: new Date() }).where(and(eq(deploymentReplicas.workerId, workerId), eq(deploymentReplicas.deploymentId, deploymentId)));
	},
};