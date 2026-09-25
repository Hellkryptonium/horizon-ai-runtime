import { Router } from "express";

import type { WorkerRepository } from "./worker.repository.js";
import { WorkerController } from "./worker.controller.js";
import { WorkerService } from "./worker.service.js";
import { WorkerDeploymentController } from "../deployments/deployments.controller.js";
import type { WorkerDeploymentService } from "../deployments/deployments.service.js";

export const createWorkerRouter = (repository: WorkerRepository, deploymentService?: WorkerDeploymentService) => {
  const router = Router();
  const controller = new WorkerController(new WorkerService(repository));

  router.post("/register", controller.register);
  router.post("/:workerId/heartbeat", controller.heartbeat);
  router.get("/", controller.list);

  if (deploymentService) {
    const deploymentController = new WorkerDeploymentController(deploymentService);
    router.get("/:workerId/deployments/pending", deploymentController.pending);
    router.post("/:workerId/deployments/:deploymentId/ack", deploymentController.acknowledge);
  }

  return router;
};