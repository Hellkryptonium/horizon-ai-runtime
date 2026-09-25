import type { NextFunction, Request, Response } from "express";

import { ModelNotFoundError } from "../models/models.service.js";
import { NoCompatibleWorkerError } from "../scheduler/scheduler.service.js";
import {
  DeploymentNotAssignedError,
  DeploymentNotFoundError,
  DeploymentNotScheduledError,
  DeploymentService,
  WorkerDeploymentService,
  WorkerNotFoundError,
} from "./deployments.service.js";
import { deploymentCreationSchema } from "./deployments.validation.js";

export class DeploymentController {
  constructor(private readonly service: DeploymentService) {}

  create = async (request: Request, response: Response, next: NextFunction) => {
    const result = deploymentCreationSchema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        success: false,
        error: "Invalid deployment request",
        issues: result.error.issues,
      });
      return;
    }

    try {
      const deployment = await this.service.createDeployment(result.data);
      response.status(201).json({ success: true, deployment });
    } catch (error) {
      if (error instanceof ModelNotFoundError) {
        response.status(404).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }

      if (error instanceof NoCompatibleWorkerError) {
        response.status(409).json({
          success: false,
          error: {
            code: error.code,
            message: "No online worker satisfies the model's resource requirements.",
          },
        });
        return;
      }

      next(error);
    }
  };

  list = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const deployments = await this.service.listDeployments();
      response.json({ success: true, deployments });
    } catch (error) {
      next(error);
    }
  };

  get = async (request: Request, response: Response, next: NextFunction) => {
    const deploymentId = request.params.deploymentId;

    if (typeof deploymentId !== "string") {
      response.status(400).json({ success: false, error: "Invalid deployment ID" });
      return;
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deploymentId)) {
      response.status(400).json({ success: false, error: "Invalid deployment ID" });
      return;
    }

    try {
      const deployment = await this.service.getDeployment(deploymentId);
      response.json({ success: true, deployment });
    } catch (error) {
      if (error instanceof DeploymentNotFoundError) {
        response.status(404).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }

      next(error);
    }
  };
}

export class WorkerDeploymentController {
  constructor(private readonly service: WorkerDeploymentService) {}

  pending = async (request: Request, response: Response, next: NextFunction) => {
    const workerId = request.params.workerId;
    if (typeof workerId !== "string") {
      response.status(400).json({ success: false, error: "Invalid worker ID" });
      return;
    }

    try {
      const pendingDeployments = await this.service.getPendingDeploymentsForWorker(workerId);
      response.json({
        success: true,
        deployments: pendingDeployments.map(({ deployment, model }) => ({
          deploymentId: deployment.id,
          modelId: deployment.modelId,
          workerId: deployment.workerId,
          status: deployment.status,
          modelName: model.name,
          modelVersion: model.version,
          runtimeModelId: model.runtimeModelId,
          format: model.format,
          runtime: model.runtime,
          sizeMb: model.sizeMb,
          minRamMb: model.minRamMb,
          minVramMb: model.minVramMb,
          requiresGpu: model.requiresGpu,
          modelArchitecture: model.modelArchitecture,
          contextLength: model.contextLength,
        })),
      });
    } catch (error) {
      this.handleProtocolError(error, response, next);
    }
  };

  acknowledge = async (request: Request, response: Response, next: NextFunction) => {
    const workerId = request.params.workerId;
    const deploymentId = request.params.deploymentId;
    if (typeof workerId !== "string" || typeof deploymentId !== "string") {
      response.status(400).json({ success: false, error: "Invalid deployment identifiers" });
      return;
    }

    if (typeof request.body?.accepted !== "boolean") {
      response.status(400).json({ success: false, error: "Invalid acknowledgement" });
      return;
    }

    try {
      await this.service.acknowledgeDeployment(
        workerId,
        deploymentId,
        request.body.accepted,
      );
      response.json({ success: true });
    } catch (error) {
      this.handleProtocolError(error, response, next);
    }
  };

  private handleProtocolError(error: unknown, response: Response, next: NextFunction) {
    if (error instanceof WorkerNotFoundError || error instanceof DeploymentNotFoundError) {
      response.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof DeploymentNotAssignedError) {
      response.status(403).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof DeploymentNotScheduledError) {
      response.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(error);
  }
}