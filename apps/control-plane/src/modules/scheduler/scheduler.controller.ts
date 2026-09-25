import type { NextFunction, Request, Response } from "express";

import { NoCompatibleWorkerError, SchedulerService } from "./scheduler.service.js";
import { schedulingRequestSchema } from "./scheduler.types.js";

export class SchedulerController {
  constructor(private readonly service: SchedulerService) {}

  select = async (request: Request, response: Response, next: NextFunction) => {
    const result = schedulingRequestSchema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        success: false,
        error: "Invalid scheduling request",
        issues: result.error.issues,
      });
      return;
    }

    try {
      const worker = await this.service.scheduleWorkload(result.data);
      response.json({
        success: true,
        worker: {
          id: worker.id,
          name: worker.name,
          status: worker.status,
          cpuCores: worker.cpuCores,
          availableRamMb: worker.availableRamMb,
          gpu: worker.gpu,
          vramMb: worker.vramMb,
          architecture: worker.architecture,
          operatingSystem: worker.operatingSystem,
        },
      });
    } catch (error) {
      if (error instanceof NoCompatibleWorkerError) {
        response.status(409).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }

      next(error);
    }
  };
}