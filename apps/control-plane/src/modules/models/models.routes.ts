import { Router } from "express";

import type { ModelRepository } from "./models.repository.js";
import { ModelController } from "./models.controller.js";
import { ModelService } from "./models.service.js";

export const createModelRouter = (repository: ModelRepository) => {
  const router = Router();
  const controller = new ModelController(new ModelService(repository));

  router.post("/", controller.create);
  router.get("/", controller.list);
  router.get("/:modelId", controller.get);

  return router;
};