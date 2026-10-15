import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { MarketplaceRequestError, MarketplaceService } from "./marketplace.service.js";

const connectionSchema = z.object({ workerId: z.string().uuid() });
const deploymentRequestSchema = z.object({
  workerId: z.string().uuid(),
  modelId: z.string().uuid(),
  connectionRequestId: z.string().uuid(),
  name: z.string().trim().min(1).max(255).optional(),
});

export class MarketplaceController {
  constructor(private readonly service: MarketplaceService) {}

  workers = async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.json({ success: true, workers: await this.service.listAvailableWorkers(request.authenticatedUser!.id) });
    } catch (error) { next(error); }
  };

  connections = async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.json({ success: true, requests: await this.service.listConnectionRequests(request.authenticatedUser!.id) });
    } catch (error) { next(error); }
  };

  createConnection = async (request: Request, response: Response, next: NextFunction) => {
    const parsed = connectionSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ success: false, error: "Invalid connection request", issues: parsed.error.issues }); return; }
    try {
      response.status(201).json({ success: true, request: await this.service.createConnectionRequest(request.authenticatedUser!.id, parsed.data.workerId) });
    } catch (error) { this.handleError(error, response, next); }
  };

  decideConnection = async (request: Request, response: Response, next: NextFunction) => {
    const decision = this.decision(request.body?.decision);
    if (!decision) { response.status(400).json({ success: false, error: "decision must be ACCEPTED, REJECTED, or CANCELLED" }); return; }
    const requestId = request.params.requestId;
    if (typeof requestId !== "string") { response.status(400).json({ success: false, error: "Invalid request ID" }); return; }
    try {
      response.json({ success: true, request: await this.service.decideConnectionRequest(requestId, request.authenticatedUser!.id, decision) });
    } catch (error) { this.handleError(error, response, next); }
  };

  deploymentRequests = async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.json({ success: true, requests: await this.service.listDeploymentRequests(request.authenticatedUser!.id) });
    } catch (error) { next(error); }
  };

  createDeploymentRequest = async (request: Request, response: Response, next: NextFunction) => {
    const parsed = deploymentRequestSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ success: false, error: "Invalid deployment request", issues: parsed.error.issues }); return; }
    try {
      response.status(201).json({ success: true, request: await this.service.createDeploymentRequest(request.authenticatedUser!.id, parsed.data) });
    } catch (error) { this.handleError(error, response, next); }
  };

  decideDeploymentRequest = async (request: Request, response: Response, next: NextFunction) => {
    const decision = this.decision(request.body?.decision);
    if (!decision) { response.status(400).json({ success: false, error: "decision must be ACCEPTED, REJECTED, or CANCELLED" }); return; }
    const requestId = request.params.requestId;
    if (typeof requestId !== "string") { response.status(400).json({ success: false, error: "Invalid request ID" }); return; }
    try {
      response.json({ success: true, request: await this.service.decideDeploymentRequest(requestId, request.authenticatedUser!.id, decision) });
    } catch (error) { this.handleError(error, response, next); }
  };

  private decision(value: unknown): "ACCEPTED" | "REJECTED" | "CANCELLED" | undefined {
    return value === "ACCEPTED" || value === "REJECTED" || value === "CANCELLED" ? value : undefined;
  }

  private handleError(error: unknown, response: Response, next: NextFunction) {
    if (!(error instanceof MarketplaceRequestError)) { next(error); return; }
    const status = error.code.endsWith("NOT_FOUND") ? 404 : error.code.endsWith("FORBIDDEN") ? 403 : error.code === "WORKER_UNAVAILABLE" || error.code === "CONNECTION_REQUIRED" ? 409 : 400;
    response.status(status).json({ success: false, error: { code: error.code, message: error.message } });
  }
}
