import { and, desc, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { deployments } from "../../db/schema.js";
import type { Deployment, NewDeployment } from "./deployments.types.js";

export interface DeploymentRepository {
  createDeployment(deployment: NewDeployment): Promise<Deployment>;
  listDeployments(): Promise<Deployment[]>;
  getDeployment(deploymentId: string): Promise<Deployment | undefined>;
  findScheduledByWorkerId(workerId: string): Promise<Deployment[]>;
}

export const deploymentRepository: DeploymentRepository = {
  async createDeployment(deployment) {
    const [createdDeployment] = await db.insert(deployments).values(deployment).returning();

    if (!createdDeployment) {
      throw new Error("Deployment insert did not return a deployment");
    }

    return createdDeployment;
  },

  async listDeployments() {
    return db.select().from(deployments).orderBy(desc(deployments.createdAt));
  },

  async getDeployment(deploymentId) {
    const [deployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, deploymentId));

    return deployment;
  },

  async findScheduledByWorkerId(workerId) {
    return db
      .select()
      .from(deployments)
      .where(and(eq(deployments.workerId, workerId), eq(deployments.status, "SCHEDULED")))
      .orderBy(desc(deployments.createdAt));
  },
};