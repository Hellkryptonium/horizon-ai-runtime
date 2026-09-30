import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../../config/env.js";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "./auth.cookies.js";
import { accountUpdateSchema, AuthService, DuplicateEmailError, InvalidCredentialsError, loginSchema, registerSchema } from "./auth.service.js";

export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await this.service.register(registerSchema.parse(request.body));
      setSessionCookie(response, result.token, env.NODE_ENV === "production");
      response.status(201).json({ success: true, user: result.user });
    } catch (error: unknown) {
      if (error instanceof DuplicateEmailError) {
        response.status(409).json({ success: false, error: { code: error.code, message: "Unable to create account." } });
        return;
      }
      if (error instanceof ZodError) {
        response.status(400).json({ success: false, error: "Invalid registration details" });
        return;
      }
      next(error);
    }
  };

  login = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const result = await this.service.login(loginSchema.parse(request.body));
      setSessionCookie(response, result.token, env.NODE_ENV === "production");
      response.status(200).json({ success: true, user: result.user });
    } catch (error: unknown) {
      if (error instanceof InvalidCredentialsError) {
        response.status(401).json({ success: false, error: { code: error.code, message: "Invalid email or password." } });
        return;
      }
      if (error instanceof ZodError) {
        response.status(400).json({ success: false, error: "Invalid login details" });
        return;
      }
      next(error);
    }
  };

  me = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const token = readSessionCookie(request);
      const user = token ? await this.service.getUserForToken(token) : undefined;
      if (!user) {
        response.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
        return;
      }
      response.json({ success: true, user });
    } catch (error: unknown) { next(error); }
  };

  logout = async (request: Request, response: Response, next: NextFunction) => {
    try {
      await this.service.logout(readSessionCookie(request));
      clearSessionCookie(response, env.NODE_ENV === "production");
      response.json({ success: true });
    } catch (error: unknown) { next(error); }
  };

  updateAccount = async (request: Request, response: Response, next: NextFunction) => {
    const result = accountUpdateSchema.safeParse(request.body);
    if (!result.success || !request.authenticatedUser) {
      response.status(!request.authenticatedUser ? 401 : 400).json({ success: false, error: !request.authenticatedUser ? { code: "UNAUTHENTICATED", message: "Authentication required." } : "Invalid account details" });
      return;
    }
    try {
      const user = await this.service.updateAccount(request.authenticatedUser.id, result.data);
      if (!user) {
        response.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "Account not found." } });
        return;
      }
      response.json({ success: true, user });
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        response.status(409).json({ success: false, error: { code: error.code, message: "That email is already in use." } });
        return;
      }
      next(error);
    }
  };

  deleteAccount = async (request: Request, response: Response, next: NextFunction) => {
    if (!request.authenticatedUser) {
      response.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
      return;
    }
    try {
      await this.service.deleteAccount(request.authenticatedUser.id);
      clearSessionCookie(response, env.NODE_ENV === "production");
      response.status(204).send();
    } catch (error) { next(error); }
  };
}
