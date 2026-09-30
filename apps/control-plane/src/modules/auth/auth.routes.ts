import { Router } from "express";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { requireAuth } from "../../middleware/auth.js";

export const createAuthRouter = (service: AuthService) => {
  const router = Router();
  const controller = new AuthController(service);
  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.get("/me", controller.me);
  router.post("/logout", controller.logout);
  router.patch("/me", requireAuth(service), controller.updateAccount);
  router.delete("/me", requireAuth(service), controller.deleteAccount);
  return router;
};
