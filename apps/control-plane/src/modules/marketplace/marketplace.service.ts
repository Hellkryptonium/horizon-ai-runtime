import { randomUUID } from "node:crypto";

import type { DeploymentCreation } from "../deployments/deployments.validation.js";
import type { DeploymentService } from "../deployments/deployments.service.js";
import type { ModelService } from "../models/models.service.js";
import type { WorkerRepository } from "../workers/worker.repository.js";
import type { ConnectionRequest, DeploymentRequest, MarketplaceRepository } from "./marketplace.repository.js";

const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

export class MarketplaceRequestError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "MarketplaceRequestError";
  }
}

export class MarketplaceService {
  constructor(
    private readonly repository: MarketplaceRepository,
    private readonly workers: Pick<WorkerRepository, "getWorker">,
    private readonly models: Pick<ModelService, "getModel">,
    private readonly deployments: Pick<DeploymentService, "createDeployment">,
  ) {}

  listAvailableWorkers(userId: string) {
    return this.repository.listAvailableWorkers(userId);
  }

  listConnectionRequests(userId: string) {
    return this.repository.expireConnectionRequests(new Date()).then(() => this.repository.listConnectionRequests(userId));
  }

  async createConnectionRequest(userId: string, workerId: string, now = new Date()) {
    const worker = await this.workers.getWorker(workerId);
    if (!worker?.userId || worker.userId === userId || worker.status !== "ONLINE") {
      throw new MarketplaceRequestError("WORKER_UNAVAILABLE", "That worker is not available for connection requests.");
    }

    return this.repository.createConnectionRequest({
      id: randomUUID(),
      requesterId: userId,
      providerId: worker.userId,
      workerId,
      status: "REQUESTED",
      expiresAt: new Date(now.getTime() + REQUEST_TTL_MS),
    });
  }

  async decideConnectionRequest(id: string, userId: string, decision: "ACCEPTED" | "REJECTED" | "CANCELLED", now = new Date()) {
    const request = await this.requireConnection(id);
    if (request.status !== "REQUESTED" || request.expiresAt <= now) {
      throw new MarketplaceRequestError("CONNECTION_REQUEST_CLOSED", "This connection request is no longer active.");
    }
    const canDecide = decision === "CANCELLED" ? request.requesterId === userId : request.providerId === userId;
    if (!canDecide) throw new MarketplaceRequestError("CONNECTION_REQUEST_FORBIDDEN", "You cannot change this connection request.");
    return this.repository.updateConnectionRequest(id, decision, now);
  }

  listDeploymentRequests(userId: string) {
    return this.repository.expireDeploymentRequests(new Date()).then(() => this.repository.listDeploymentRequests(userId));
  }

  async createDeploymentRequest(userId: string, input: { workerId: string; modelId: string; connectionRequestId: string; name?: string }, now = new Date()) {
    const connection = await this.requireConnection(input.connectionRequestId);
    if (connection.requesterId !== userId || connection.workerId !== input.workerId || connection.status !== "ACCEPTED") {
      throw new MarketplaceRequestError("CONNECTION_REQUIRED", "An accepted connection is required before requesting deployment.");
    }
    const worker = await this.workers.getWorker(input.workerId);
    if (!worker?.userId || worker.userId !== connection.providerId || worker.status !== "ONLINE") {
      throw new MarketplaceRequestError("WORKER_UNAVAILABLE", "That worker is no longer available.");
    }
    await this.models.getModel(input.modelId);

    return this.repository.createDeploymentRequest({
      id: randomUUID(),
      requesterId: userId,
      providerId: connection.providerId,
      workerId: input.workerId,
      modelId: input.modelId,
      connectionRequestId: input.connectionRequestId,
      name: input.name ?? "Marketplace deployment",
      status: "REQUESTED",
      expiresAt: new Date(now.getTime() + REQUEST_TTL_MS),
    });
  }

  async decideDeploymentRequest(id: string, userId: string, decision: "ACCEPTED" | "REJECTED" | "CANCELLED", now = new Date()) {
    const request = await this.requireDeploymentRequest(id);
    if (request.status !== "REQUESTED" || request.expiresAt <= now) {
      throw new MarketplaceRequestError("DEPLOYMENT_REQUEST_CLOSED", "This deployment request is no longer active.");
    }
    const canDecide = decision === "CANCELLED" ? request.requesterId === userId : request.providerId === userId;
    if (!canDecide) throw new MarketplaceRequestError("DEPLOYMENT_REQUEST_FORBIDDEN", "You cannot change this deployment request.");
    if (decision !== "ACCEPTED") return this.repository.updateDeploymentRequest(id, { status: decision, respondedAt: now });

    await this.repository.updateDeploymentRequest(id, { status: "ACCEPTED", respondedAt: now });
    try {
      const deployment = await this.deployments.createDeployment({
        modelId: request.modelId,
        workerId: request.workerId,
        name: request.name ?? undefined,
      } satisfies DeploymentCreation, request.requesterId, request.providerId);
      return this.repository.updateDeploymentRequest(id, { status: "DEPLOYING", deploymentId: deployment.id });
    } catch (error) {
      await this.repository.updateDeploymentRequest(id, { status: "FAILED" });
      throw error;
    }
  }

  private async requireConnection(id: string): Promise<ConnectionRequest> {
    const request = await this.repository.getConnectionRequest(id);
    if (!request) throw new MarketplaceRequestError("CONNECTION_REQUEST_NOT_FOUND", "Connection request not found.");
    return request;
  }

  private async requireDeploymentRequest(id: string): Promise<DeploymentRequest> {
    const request = await this.repository.getDeploymentRequest(id);
    if (!request) throw new MarketplaceRequestError("DEPLOYMENT_REQUEST_NOT_FOUND", "Deployment request not found.");
    return request;
  }
}
