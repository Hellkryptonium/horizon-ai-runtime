import { Router } from "express";

import type { ModelRepository } from "./models.repository.js";
import { ModelController } from "./models.controller.js";
import { ModelService } from "./models.service.js";

export const createModelRouter = (repository: ModelRepository, deployments?: { hasByModelId?: (modelId: string) => Promise<boolean> }) => {
  const router = Router();
  const controller = new ModelController(new ModelService(repository, deployments));

  router.post("/", controller.create);
  router.get("/", controller.list);
  router.get("/:modelId", controller.get);
  router.patch("/:modelId", controller.update);
  router.delete("/:modelId", controller.remove);

  return router;
};