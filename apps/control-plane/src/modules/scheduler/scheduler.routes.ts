import { Router } from "express";

import type { WorkerRepository } from "../workers/worker.repository.js";
import { SchedulerController } from "./scheduler.controller.js";
import { SchedulerService } from "./scheduler.service.js";

export const createSchedulerRouter = (repository: Pick<WorkerRepository, "listWorkers">) => {
  const router = Router();
  const controller = new SchedulerController(new SchedulerService(repository));

  router.post("/select", controller.select);

  return router;
};