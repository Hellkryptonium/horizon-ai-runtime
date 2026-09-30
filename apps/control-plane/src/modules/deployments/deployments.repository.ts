import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "../../db/index.js";
import { deployments } from "../../db/schema.js";
import type { Deployment, NewDeployment } from "./deployments.types.js";

export interface DeploymentRepository {
  createDeployment(deployment: NewDeployment): Promise<Deployment>;
  listDeployments(userId: string): Promise<Deployment[]>;
  getDeployment(deploymentId: string, userId?: string): Promise<Deployment | undefined>;
  findScheduledByWorkerId(workerId: string): Promise<Deployment[]>;
  updateStatus(deploymentId: string, status: Deployment["status"]): Promise<Deployment | undefined>;
  updateDeployment(deploymentId: string, userId: string, updates: { name?: string; status?: Deployment["status"] }): Promise<Deployment | undefined>;
  deleteDeployment(deploymentId: string, userId: string): Promise<boolean>;
  markActiveByWorkerId(workerId: string, status: "FAILED" | "STOPPED"): Promise<Deployment[]>;
  hasActiveByWorkerId?(workerId: string): Promise<boolean>;
  hasByModelId?(modelId: string): Promise<boolean>;
}

export const deploymentRepository: DeploymentRepository = {
  async createDeployment(deployment) {
    const [createdDeployment] = await db.insert(deployments).values(deployment).returning();

    if (!createdDeployment) {
      throw new Error("Deployment insert did not return a deployment");
    }

    return createdDeployment;
  },

  async listDeployments(userId) {
    return db.select().from(deployments).where(eq(deployments.userId, userId)).orderBy(desc(deployments.createdAt));
  },

  async getDeployment(deploymentId, userId) {
    const [deployment] = await db
      .select()
      .from(deployments)
      .where(userId ? and(eq(deployments.id, deploymentId), eq(deployments.userId, userId)) : eq(deployments.id, deploymentId));

    return deployment;
  },

  async findScheduledByWorkerId(workerId) {
    return db
      .select()
      .from(deployments)
      .where(and(eq(deployments.workerId, workerId), eq(deployments.status, "SCHEDULED")))
      .orderBy(desc(deployments.createdAt));
  },

  async updateStatus(deploymentId, status) {
    const [updated] = await db
      .update(deployments)
      .set({ status, updatedAt: new Date() })
      .where(eq(deployments.id, deploymentId))
      .returning();
    return updated;
  },

  async updateDeployment(deploymentId, userId, updates) {
    const [updated] = await db.update(deployments).set({ ...updates, updatedAt: new Date() }).where(and(eq(deployments.id, deploymentId), eq(deployments.userId, userId))).returning();
    return updated;
  },

  async deleteDeployment(deploymentId, userId) {
    const deleted = await db.delete(deployments).where(and(eq(deployments.id, deploymentId), eq(deployments.userId, userId))).returning({ id: deployments.id });
    return deleted.length > 0;
  },

  async markActiveByWorkerId(workerId, status) {
    return db.update(deployments).set({ status, updatedAt: new Date() }).where(and(eq(deployments.workerId, workerId), inArray(deployments.status, ["PENDING", "DEPLOYING", "RUNNING", "STOPPING"]))).returning();
  },

  async hasActiveByWorkerId(workerId) {
    const [deployment] = await db
      .select({ id: deployments.id })
      .from(deployments)
      .where(and(eq(deployments.workerId, workerId), inArray(deployments.status, ["PENDING", "SCHEDULED", "DEPLOYING", "RUNNING", "STOPPING"])))
      .limit(1);
    return Boolean(deployment);
  },

  async hasByModelId(modelId) {
    const [deployment] = await db.select({ id: deployments.id }).from(deployments).where(eq(deployments.modelId, modelId)).limit(1);
    return Boolean(deployment);
  },
};