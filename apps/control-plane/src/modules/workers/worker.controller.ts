import type { NextFunction, Request, Response } from "express";

import {
  WorkerService,
  workerEnrollmentSchema,
  workerHeartbeatSchema,
} from "./worker.service.js";
import { InvalidWorkerEnrollmentError, WorkerEnrollmentService, WorkerOwnershipError } from "./enrollment.service.js";

export class WorkerController {
  constructor(
    private readonly service: WorkerService,
    private readonly enrollmentService: WorkerEnrollmentService,
  ) {}

  createEnrollment = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await this.enrollmentService.createEnrollment(request.authenticatedUser!.id);
      response.status(201).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  enroll = async (request: Request, response: Response, next: NextFunction) => {
    const result = workerEnrollmentSchema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        success: false,
        error: "Invalid worker enrollment",
        issues: result.error.issues,
      });
      return;
    }

    try {
      const { token, ...registration } = result.data;
      const worker = await this.enrollmentService.enrollWorker(token, registration);
      const { credentialHash: _credentialHash, credential, ...publicWorker } = worker;
      response.status(201).json({ success: true, worker: { ...publicWorker, credential } });
    } catch (error) {
      if (error instanceof InvalidWorkerEnrollmentError) {
        response.status(401).json({ success: false, error: { code: error.code, message: "Invalid or expired enrollment token." } });
        return;
      }
      if (error instanceof WorkerOwnershipError) {
        response.status(409).json({ success: false, error: { code: error.code, message: "Worker belongs to another user." } });
        return;
      }
      next(error);
    }
  };

  list = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const workers = await this.service.listWorkers(request.authenticatedUser!.id);
      response.json({ success: true, workers: workers.map(({ credentialHash: _credentialHash, ...worker }) => worker) });
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