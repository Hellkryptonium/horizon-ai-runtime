import type { NextFunction, Request, Response } from "express";

import {
  WorkerService,
  workerHeartbeatSchema,
  workerRegistrationSchema,
} from "./worker.service.js";

export class WorkerController {
  constructor(private readonly service: WorkerService) {}

  register = async (request: Request, response: Response, next: NextFunction) => {
    const result = workerRegistrationSchema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        success: false,
        error: "Invalid worker registration",
        issues: result.error.issues,
      });
      return;
    }

    try {
      const worker = await this.service.registerWorker(result.data);
      response.status(201).json({ success: true, worker });
    } catch (error) {
      next(error);
    }
  };

  list = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const workers = await this.service.listWorkers();
      response.json({ success: true, workers });
    } catch (error) {
      next(error);
    }
  };

  heartbeat = async (request: Request, response: Response, next: NextFunction) => {
    const result = workerHeartbeatSchema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        success: false,
        error: "Invalid worker heartbeat",
        issues: result.error.issues,
      });
      return;
    }

    try {
      const workerId = request.params.workerId;

      if (typeof workerId !== "string") {
        response.status(400).json({ success: false, error: "Invalid worker ID" });
        return;
      }

      const worker = await this.service.heartbeat(workerId, result.data);

      if (!worker) {
        response.status(404).json({ success: false, error: "Worker not found" });
        return;
      }

      response.json({
        success: true,
        workerId: worker.id,
        status: worker.status,
      });
    } catch (error) {
      next(error);
    }
  };
}