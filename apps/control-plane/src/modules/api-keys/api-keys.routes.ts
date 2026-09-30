import { Router } from "express";

import { requireAuth } from "../../middleware/auth.js";
import { AuthService } from "../auth/auth.service.js";
import { ApiKeyController } from "./api-keys.controller.js";
import { ApiKeyService } from "./api-keys.service.js";

export const createApiKeyRouter = (service: ApiKeyService, auth: AuthService) => {
  const router = Router();
  const controller = new ApiKeyController(service);
  router.use(requireAuth(auth));
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.delete("/:keyId", controller.revoke);
  return router;
};
