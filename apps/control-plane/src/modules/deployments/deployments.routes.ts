import { Router } from "express";

import type { ModelService } from "../models/models.service.js";
import { DeploymentController } from "./deployments.controller.js";
import type { DeploymentRepository } from "./deployments.repository.js";
import { DeploymentService } from "./deployments.service.js";
import type { WorkerRepository } from "../workers/worker.repository.js";
import type { WorkerConnectionManager } from "../workers/worker.connection-manager.js";
import { requireAuth } from "../../middleware/auth.js";
import { AuthService } from "../auth/auth.service.js";

export const createDeploymentRouter = (
  modelService: Pick<ModelService, "getModel">,
  repository: DeploymentRepository,
  workers: WorkerRepository,
  connectionManager: Pick<WorkerConnectionManager, "sendToWorker" | "isWorkerConnected" | "requestInference">,
  auth: AuthService,
) => {
  const router = Router();
  const controller = new DeploymentController(
    new DeploymentService(modelService, repository, workers, connectionManager),
  );

  router.post("/", requireAuth(auth), controller.create);
  router.get("/", controller.list);
  router.get("/:deploymentId", controller.get);
  router.post("/:deploymentId/inference", requireAuth(auth), controller.inference);

  return router;
};