import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { ApiKeyNotFoundError, ApiKeyService, apiKeyCreateSchema } from "./api-keys.service.js";

export class ApiKeyController {
  constructor(private readonly service: ApiKeyService) {}

  list = async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.json({ success: true, keys: await this.service.list(request.authenticatedUser!.id) });
    } catch (error) { next(error); }
  };

  create = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const input = apiKeyCreateSchema.parse(request.body);
      response.status(201).json({ success: true, ...await this.service.create(request.authenticatedUser!.id, input) });
    } catch (error) {
      if (error instanceof ZodError) { response.status(400).json({ success: false, error: "Invalid API key details" }); return; }
      next(error);
    }
  };

  revoke = async (request: Request, response: Response, next: NextFunction) => {
    if (typeof request.params.keyId !== "string") {
      response.status(400).json({ success: false, error: "Invalid API key ID" });
      return;
    }
    try {
      await this.service.revoke(request.params.keyId, request.authenticatedUser!.id);
      response.status(204).send();
    } catch (error) {
      if (error instanceof ApiKeyNotFoundError) { response.status(404).json({ success: false, error: { code: error.code, message: error.message } }); return; }
      next(error);
    }
  };
}
