import { Router } from "express";

import type { ModelService } from "../models/models.service.js";
import { DeploymentController } from "./deployments.controller.js";
import type { DeploymentRepository } from "./deployments.repository.js";
import { DeploymentService } from "./deployments.service.js";
import type { WorkerRepository } from "../workers/worker.repository.js";
import type { WorkerConnectionManager } from "../workers/worker.connection-manager.js";
import { requireAuth } from "../../middleware/auth.js";
import { AuthService } from "../auth/auth.service.js";
import { requireApiKey } from "../api-keys/api-keys.middleware.js";
import type { ApiKeyService } from "../api-keys/api-keys.service.js";
import { publicRateLimit } from "../../middleware/public-rate-limit.js";
import type { InferenceQueue } from "../inference/inference.queue.js";
import { replicaRepository } from "./replica.repository.js";

export const createDeploymentRouter = (
  modelService: Pick<ModelService, "getModel">,
  repository: DeploymentRepository,
  workers: WorkerRepository,
  connectionManager: Pick<WorkerConnectionManager, "sendToWorker" | "isWorkerConnected" | "requestInference"> & {
    requestDeploymentStop?: WorkerConnectionManager["requestDeploymentStop"];
  },
  auth: AuthService,
  inferenceQueue?: InferenceQueue,
) => {
  const router = Router();
  const controller = new DeploymentController(
    new DeploymentService(modelService, repository, workers, connectionManager, inferenceQueue, replicaRepository),
  );

  router.post("/", requireAuth(auth), controller.create);
  router.get("/", requireAuth(auth), controller.list);
  router.get("/:deploymentId", requireAuth(auth), controller.get);
  router.patch("/:deploymentId", requireAuth(auth), controller.update);
  router.delete("/:deploymentId", requireAuth(auth), controller.remove);
  router.post("/:deploymentId/stop", requireAuth(auth), controller.stop);
  router.post("/:deploymentId/restart", requireAuth(auth), controller.restart);
  router.post("/:deploymentId/inference", requireAuth(auth), controller.inference);

  return router;
};

export const createPublicInferenceRouter = (
  modelService: Pick<ModelService, "getModel">,
  repository: DeploymentRepository,
  workers: WorkerRepository,
  connectionManager: Pick<WorkerConnectionManager, "sendToWorker" | "isWorkerConnected" | "requestInference">,
  apiKeys: ApiKeyService,
  inferenceQueue?: InferenceQueue,
) => {
  const router = Router();
  const controller = new DeploymentController(new DeploymentService(modelService, repository, workers, connectionManager, inferenceQueue, replicaRepository));
  router.post("/deployments/:deploymentId/inference", requireApiKey(apiKeys), controller.inference);
  router.post("/chat/completions", requireApiKey(apiKeys), publicRateLimit, controller.chatCompletions);
  return router;
};