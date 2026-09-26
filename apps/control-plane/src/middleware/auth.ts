import type { NextFunction, Request, Response } from "express";

import { readSessionCookie } from "../modules/auth/auth.cookies.js";
import { AuthService } from "../modules/auth/auth.service.js";
import type { SafeUser } from "../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request { authenticatedUser?: SafeUser; }
  }
}

export const requireAuth = (service: AuthService) => async (request: Request, response: Response, next: NextFunction) => {
  const token = readSessionCookie(request);
  const user = token ? await service.getUserForToken(token) : undefined;
  if (!user) {
    response.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    return;
  }
  request.authenticatedUser = user;
  next();
};
