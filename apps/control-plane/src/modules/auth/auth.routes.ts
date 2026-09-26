import { Router } from "express";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";

export const createAuthRouter = (service: AuthService) => {
  const router = Router();
  const controller = new AuthController(service);
  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.get("/me", controller.me);
  router.post("/logout", controller.logout);
  return router;
};
