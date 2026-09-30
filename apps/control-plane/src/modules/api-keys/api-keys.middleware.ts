import type { NextFunction, Request, Response } from "express";

import type { ApiKeyService } from "./api-keys.service.js";

export const requireApiKey = (service: ApiKeyService) => async (request: Request, response: Response, next: NextFunction) => {
  const value = request.headers.authorization;
  const token = value?.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() : undefined;
  const user = token ? await service.authenticate(token) : undefined;
  if (!user) {
    response.status(401).json({ success: false, error: { code: "INVALID_API_KEY", message: "A valid API key is required." } });
    return;
  }
  request.authenticatedUser = user;
  next();
};
