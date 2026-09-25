import type { NextFunction, Request, Response } from "express";

import { ModelNotFoundError, ModelService } from "./models.service.js";
import { modelCreationSchema } from "./models.validation.js";

export class ModelController {
  constructor(private readonly service: ModelService) {}

  create = async (request: Request, response: Response, next: NextFunction) => {
    const result = modelCreationSchema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        success: false,
        error: "Invalid model metadata",
        issues: result.error.issues,
      });
      return;
    }

    try {
      const model = await this.service.createModel(result.data);
      response.status(201).json({ success: true, model });
    } catch (error) {
      next(error);
    }
  };

  list = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const models = await this.service.listModels();
      response.json({ success: true, models });
    } catch (error) {
      next(error);
    }
  };

  get = async (request: Request, response: Response, next: NextFunction) => {
    if (typeof request.params.modelId !== "string") {
      response.status(400).json({ success: false, error: "Invalid model ID" });
      return;
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.modelId)) {
      response.status(400).json({ success: false, error: "Invalid model ID" });
      return;
    }

    try {
      const model = await this.service.getModel(request.params.modelId);
      response.json({ success: true, model });
    } catch (error) {
      if (error instanceof ModelNotFoundError) {
        response.status(404).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }

      next(error);
    }
  };
}