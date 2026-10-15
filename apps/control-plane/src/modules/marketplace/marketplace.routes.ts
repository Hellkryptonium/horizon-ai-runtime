import { Router } from "express";

import type { AuthService } from "../auth/auth.service.js";
import type { DeploymentService } from "../deployments/deployments.service.js";
import type { ModelService } from "../models/models.service.js";
import { requireAuth } from "../../middleware/auth.js";
import type { WorkerRepository } from "../workers/worker.repository.js";
import { marketplaceRepository, type MarketplaceRepository } from "./marketplace.repository.js";
import { MarketplaceController } from "./marketplace.controller.js";
import { MarketplaceService } from "./marketplace.service.js";

export const createMarketplaceRouter = (
  auth: AuthService,
  workers: Pick<WorkerRepository, "getWorker">,
  models: Pick<ModelService, "getModel">,
  deployments: Pick<DeploymentService, "createDeployment">,
  repository: MarketplaceRepository = marketplaceRepository,
) => {
  const router = Router();
  const controller = new MarketplaceController(new MarketplaceService(repository, workers, models, deployments));
  router.use(requireAuth(auth));
  router.get("/workers", controller.workers);
  router.get("/connections", controller.connections);
  router.post("/connections", controller.createConnection);
  router.post("/connections/:requestId/decision", controller.decideConnection);
  router.get("/deployment-requests", controller.deploymentRequests);
  router.post("/deployment-requests", controller.createDeploymentRequest);
  router.post("/deployment-requests/:requestId/decision", controller.decideDeploymentRequest);
  return router;
};
