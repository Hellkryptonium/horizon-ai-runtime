import { Router } from "express";

import type { ModelService } from "../models/models.service.js";
import type { SchedulerService } from "../scheduler/scheduler.service.js";
import { DeploymentController } from "./deployments.controller.js";
import type { DeploymentRepository } from "./deployments.repository.js";
import { DeploymentService } from "./deployments.service.js";

export const createDeploymentRouter = (
  modelService: Pick<ModelService, "getModel">,
  schedulerService: Pick<SchedulerService, "scheduleWorkload">,
  repository: DeploymentRepository,
) => {
  const router = Router();
  const controller = new DeploymentController(
    new DeploymentService(modelService, schedulerService, repository),
  );

  router.post("/", controller.create);
  router.get("/", controller.list);
  router.get("/:deploymentId", controller.get);

  return router;
};