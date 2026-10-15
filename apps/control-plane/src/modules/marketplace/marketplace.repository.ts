import { and, desc, eq, isNull, isNotNull, lt, ne, or } from "drizzle-orm";

import { db } from "../../db/index.js";
import { connectionRequests, deploymentRequests, users, workers } from "../../db/schema.js";

export type ConnectionRequest = typeof connectionRequests.$inferSelect;
export type NewConnectionRequest = typeof connectionRequests.$inferInsert;
export type DeploymentRequest = typeof deploymentRequests.$inferSelect;
export type NewDeploymentRequest = typeof deploymentRequests.$inferInsert;

export interface MarketplaceRepository {
  listAvailableWorkers(userId: string): Promise<Array<typeof workers.$inferSelect & { providerName: string }>>;
  createConnectionRequest(request: NewConnectionRequest): Promise<ConnectionRequest>;
  getConnectionRequest(id: string): Promise<ConnectionRequest | undefined>;
  listConnectionRequests(userId: string): Promise<ConnectionRequest[]>;
  updateConnectionRequest(id: string, status: ConnectionRequest["status"], respondedAt?: Date): Promise<ConnectionRequest | undefined>;
  expireConnectionRequests(now: Date): Promise<void>;
  createDeploymentRequest(request: NewDeploymentRequest): Promise<DeploymentRequest>;
  getDeploymentRequest(id: string): Promise<DeploymentRequest | undefined>;
  listDeploymentRequests(userId: string): Promise<DeploymentRequest[]>;
  updateDeploymentRequest(id: string, updates: Partial<Pick<DeploymentRequest, "status" | "deploymentId" | "respondedAt">>): Promise<DeploymentRequest | undefined>;
  expireDeploymentRequests(now: Date): Promise<void>;
}

export const marketplaceRepository: MarketplaceRepository = {
  async listAvailableWorkers(userId) {
    return db
      .select({ worker: workers, providerName: users.name })
      .from(workers)
      .innerJoin(users, eq(workers.userId, users.id))
      .where(and(eq(workers.status, "ONLINE"), isNull(workers.revokedAt), isNotNull(workers.userId), ne(users.id, userId)))
      .orderBy(desc(workers.updatedAt))
      .then((rows) => rows.filter((row) => row.worker.userId !== userId).map((row) => ({ ...row.worker, providerName: row.providerName })));
  },

  async createConnectionRequest(request) {
    const [created] = await db.insert(connectionRequests).values(request).returning();
    if (!created) throw new Error("Connection request insert did not return a request");
    return created;
  },

  async getConnectionRequest(id) {
    const [request] = await db.select().from(connectionRequests).where(eq(connectionRequests.id, id));
    return request;
  },

  async listConnectionRequests(userId) {
    return db.select().from(connectionRequests).where(or(eq(connectionRequests.requesterId, userId), eq(connectionRequests.providerId, userId))).orderBy(desc(connectionRequests.createdAt));
  },

  async updateConnectionRequest(id, status, respondedAt) {
    const [updated] = await db.update(connectionRequests).set({ status, respondedAt: respondedAt ?? null, updatedAt: new Date() }).where(eq(connectionRequests.id, id)).returning();
    return updated;
  },

  async expireConnectionRequests(now) {
    await db.update(connectionRequests).set({ status: "EXPIRED", updatedAt: now }).where(and(eq(connectionRequests.status, "REQUESTED"), lt(connectionRequests.expiresAt, now)));
  },

  async createDeploymentRequest(request) {
    const [created] = await db.insert(deploymentRequests).values(request).returning();
    if (!created) throw new Error("Deployment request insert did not return a request");
    return created;
  },

  async getDeploymentRequest(id) {
    const [request] = await db.select().from(deploymentRequests).where(eq(deploymentRequests.id, id));
    return request;
  },

  async listDeploymentRequests(userId) {
    return db.select().from(deploymentRequests).where(or(eq(deploymentRequests.requesterId, userId), eq(deploymentRequests.providerId, userId))).orderBy(desc(deploymentRequests.createdAt));
  },

  async updateDeploymentRequest(id, updates) {
    const [updated] = await db.update(deploymentRequests).set({ ...updates, updatedAt: new Date() }).where(eq(deploymentRequests.id, id)).returning();
    return updated;
  },

  async expireDeploymentRequests(now) {
    await db.update(deploymentRequests).set({ status: "EXPIRED", updatedAt: now }).where(and(eq(deploymentRequests.status, "REQUESTED"), lt(deploymentRequests.expiresAt, now)));
  },
};
