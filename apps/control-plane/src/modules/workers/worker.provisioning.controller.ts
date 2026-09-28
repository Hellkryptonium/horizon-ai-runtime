import type { NextFunction, Request, Response } from "express";

import type { ProvisioningOperation } from "./worker.protocol.js";
import {
  ProvisioningOwnershipError,
  ProvisioningWorkerNotFoundError,
  ProvisioningWorkerOfflineError,
  WorkerProvisioningService,
} from "./worker.provisioning.service.js";

export class WorkerProvisioningController {
  constructor(private readonly service: WorkerProvisioningService) {}

  health = (request: Request, response: Response, next: NextFunction) => this.run(request, response, next, "runtime.health");
  install = (request: Request, response: Response, next: NextFunction) => this.run(request, response, next, "runtime.install");
  models = (request: Request, response: Response, next: NextFunction) => this.run(request, response, next, "model.status");

  pull = async (request: Request, response: Response, next: NextFunction) => {
    const modelId = request.body?.modelId;
    if (typeof modelId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(modelId)) {
      response.status(400).json({ success: false, error: "A valid modelId is required." });
      return;
    }
    await this.run(request, response, next, "model.pull", modelId);
  };

  private async run(request: Request, response: Response, next: NextFunction, operation: ProvisioningOperation, modelId?: string) {
    const workerId = request.params.workerId;
    const userId = request.authenticatedUser?.id;
    if (!userId || typeof workerId !== "string") {
      response.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
      return;
    }
    try {
      const data = await this.service.request(userId, workerId, operation, modelId);
      response.json({ success: true, operation, data });
    } catch (error) {
      if (error instanceof ProvisioningWorkerNotFoundError) {
        response.status(404).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }
      if (error instanceof ProvisioningOwnershipError) {
        response.status(403).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }
      if (error instanceof ProvisioningWorkerOfflineError) {
        response.status(409).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  }
}
