import type { NextFunction, Request, Response } from "express";

import { ModelNotFoundError } from "../models/models.service.js";
import {
  DeploymentNotAssignedError,
  DeploymentNotFoundError,
  DeploymentNotScheduledError,
  DeploymentService,
  WorkerDeploymentService,
  WorkerNotFoundError,
  WorkerOfflineError,
  WorkerIncompatibleError,
  DeploymentNotRunningError,
  InferenceFailedError,
  DeploymentActiveError,
  DeploymentStopFailedError,
} from "./deployments.service.js";
import { deploymentCreationSchema, deploymentUpdateSchema } from "./deployments.validation.js";
import { z } from "zod";
import { InferenceQueueFullError } from "../inference/inference.queue.js";

const chatCompletionRequest = z.object({
  model: z.string().min(1),
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string().min(1) })).min(1),
});

const tokenCount = (value: string) => Math.max(1, Math.ceil(value.trim().length / 4));

export class DeploymentController {
  constructor(private readonly service: DeploymentService) {}

  create = async (request: Request, response: Response, next: NextFunction) => {
    const result = deploymentCreationSchema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        success: false,
        error: "Invalid deployment request",
        issues: result.error.issues,
      });
      return;
    }

    try {
      if (!request.authenticatedUser) {
        response.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
        return;
      }
      const deployment = await this.service.createDeployment(result.data, request.authenticatedUser.id);
      response.status(201).json({ success: true, deployment });
    } catch (error) {
      if (error instanceof ModelNotFoundError) {
        response.status(404).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }

      if (error instanceof WorkerNotFoundError || error instanceof WorkerOfflineError || error instanceof WorkerIncompatibleError) {
        response.status(error instanceof WorkerNotFoundError ? 404 : 409).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }

      next(error);
    }
  };

  list = async (request: Request, response: Response, next: NextFunction) => {
    if (!request.authenticatedUser) {
      response.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
      return;
    }
    try {
      const deployments = await this.service.listDeployments(request.authenticatedUser.id);
      response.json({ success: true, deployments });
    } catch (error) {
      next(error);
    }
  };

  get = async (request: Request, response: Response, next: NextFunction) => {
    const deploymentId = request.params.deploymentId;
    if (typeof deploymentId !== "string") { response.status(400).json({ success: false, error: "Invalid deployment ID" }); return; }

    if (typeof deploymentId !== "string") {
      response.status(400).json({ success: false, error: "Invalid deployment ID" });
      return;
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deploymentId)) {
      response.status(400).json({ success: false, error: "Invalid deployment ID" });
      return;
    }

    try {
      const deployment = await this.service.getDeployment(deploymentId, request.authenticatedUser?.id);
      response.json({ success: true, deployment });
    } catch (error) {
      if (error instanceof DeploymentNotFoundError) {
        response.status(404).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }

      next(error);
    }
  };

  inference = async (request: Request, response: Response, next: NextFunction) => {
    const deploymentId = request.params.deploymentId;
    const prompt = request.body?.prompt;
    if (typeof deploymentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deploymentId)) {
      response.status(400).json({ success: false, error: "Invalid deployment ID" });
      return;
    }
    if (typeof prompt !== "string" || prompt.trim() === "") {
      response.status(400).json({ success: false, error: "Prompt is required" });
      return;
    }
    if (!request.authenticatedUser) {
      response.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
      return;
    }
    try {
      const inference = await this.service.inferDeployment(deploymentId, request.authenticatedUser.id, prompt, request.requestId);
      response.json({ success: true, response: inference, requestId: request.requestId });
    } catch (error) {
      if (error instanceof DeploymentNotFoundError || error instanceof WorkerNotFoundError) {
        response.status(404).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }
      if (error instanceof DeploymentNotRunningError || error instanceof WorkerOfflineError) {
        response.status(409).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }
      if (error instanceof InferenceFailedError) {
        response.status(502).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }
      if (error instanceof InferenceQueueFullError) {
        response.status(429).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };

  chatCompletions = async (request: Request, response: Response, next: NextFunction) => {
    const parsed = chatCompletionRequest.safeParse(request.body);
    const deploymentId = request.body?.deployment_id ?? request.body?.deploymentId;
    if (!parsed.success || typeof deploymentId !== "string" || !request.authenticatedUser) {
      response.status(!request.authenticatedUser ? 401 : 400).json({ error: { message: !request.authenticatedUser ? "A valid API key is required." : "deployment_id and messages are required.", type: "invalid_request_error" } });
      return;
    }
    const prompt = parsed.data.messages.map((message) => `${message.role}: ${message.content}`).join("\n");
    try {
      const content = await this.service.inferDeployment(deploymentId, request.authenticatedUser.id, prompt, request.requestId);
      const promptTokens = tokenCount(prompt);
      const completionTokens = tokenCount(content);
      response.json({ id: `chatcmpl-${request.requestId}`, object: "chat.completion", created: Math.floor(Date.now() / 1000), model: parsed.data.model, choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens } });
    } catch (error) {
      next(error);
    }
  };

  update = async (request: Request, response: Response, next: NextFunction) => {
    const deploymentId = request.params.deploymentId;
    if (typeof deploymentId !== "string") { response.status(400).json({ success: false, error: "Invalid deployment ID" }); return; }
    const result = deploymentUpdateSchema.safeParse(request.body);
    if (!result.success || !request.authenticatedUser) {
      response.status(!request.authenticatedUser ? 401 : 400).json({ success: false, error: !request.authenticatedUser ? { code: "UNAUTHENTICATED", message: "Authentication required." } : "Invalid deployment update" });
      return;
    }
    try {
      const deployment = await this.service.renameDeployment(deploymentId, request.authenticatedUser.id, result.data.name);
      response.json({ success: true, deployment });
    } catch (error) {
      if (error instanceof DeploymentNotFoundError) { response.status(404).json({ success: false, error: { code: error.code, message: error.message } }); return; }
      next(error);
    }
  };

  remove = async (request: Request, response: Response, next: NextFunction) => {
    if (!request.authenticatedUser) { response.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } }); return; }
    const deploymentId = request.params.deploymentId;
    if (typeof deploymentId !== "string") { response.status(400).json({ success: false, error: "Invalid deployment ID" }); return; }
    try {
      await this.service.deleteDeployment(deploymentId, request.authenticatedUser.id);
      response.status(204).send();
    } catch (error) {
      if (error instanceof DeploymentNotFoundError) { response.status(404).json({ success: false, error: { code: error.code, message: error.message } }); return; }
      if (error instanceof DeploymentActiveError) { response.status(409).json({ success: false, error: { code: error.code, message: error.message } }); return; }
      next(error);
    }
  };

  stop = async (request: Request, response: Response, next: NextFunction) => {
    if (!request.authenticatedUser) {
      response.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
      return;
    }
    const deploymentId = request.params.deploymentId;
    if (typeof deploymentId !== "string") {
      response.status(400).json({ success: false, error: "Invalid deployment ID" });
      return;
    }
    try {
      const deployment = await this.service.stopDeployment(deploymentId, request.authenticatedUser.id);
      response.json({ success: true, deployment });
    } catch (error) {
      if (error instanceof DeploymentNotFoundError) {
        response.status(404).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }
      if (error instanceof DeploymentNotRunningError || error instanceof WorkerOfflineError) {
        response.status(409).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }
      if (error instanceof DeploymentStopFailedError) {
        response.status(502).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };

  restart = async (request: Request, response: Response, next: NextFunction) => {
    if (!request.authenticatedUser) {
      response.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
      return;
    }
    const deploymentId = request.params.deploymentId;
    if (typeof deploymentId !== "string") {
      response.status(400).json({ success: false, error: "Invalid deployment ID" });
      return;
    }
    try {
      const deployment = await this.service.restartDeployment(deploymentId, request.authenticatedUser.id);
      response.json({ success: true, deployment });
    } catch (error) {
      if (error instanceof DeploymentNotFoundError || error instanceof WorkerNotFoundError) {
        response.status(404).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }
      if (error instanceof DeploymentNotRunningError || error instanceof WorkerOfflineError || error instanceof WorkerIncompatibleError) {
        response.status(409).json({ success: false, error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };
}

export class WorkerDeploymentController {
  constructor(private readonly service: WorkerDeploymentService) {}

  pending = async (request: Request, response: Response, next: NextFunction) => {
    const workerId = request.params.workerId;
    if (typeof workerId !== "string") {
      response.status(400).json({ success: false, error: "Invalid worker ID" });
      return;
    }

    try {
      const pendingDeployments = await this.service.getPendingDeploymentsForWorker(workerId);
      response.json({
        success: true,
        deployments: pendingDeployments.map(({ deployment, model }) => ({
          deploymentId: deployment.id,
          modelId: deployment.modelId,
          workerId: deployment.workerId,
          status: deployment.status,
          modelName: model.name,
          modelVersion: model.version,
          runtimeModelId: model.runtimeModelId,
          format: model.format,
          runtime: model.runtime,
          sizeMb: model.sizeMb,
          minRamMb: model.minRamMb,
          minVramMb: model.minVramMb,
          requiresGpu: model.requiresGpu,
          modelArchitecture: model.modelArchitecture,
          contextLength: model.contextLength,
        })),
      });
    } catch (error) {
      this.handleProtocolError(error, response, next);
    }
  };

  acknowledge = async (request: Request, response: Response, next: NextFunction) => {
    const workerId = request.params.workerId;
    const deploymentId = request.params.deploymentId;
    if (typeof workerId !== "string" || typeof deploymentId !== "string") {
      response.status(400).json({ success: false, error: "Invalid deployment identifiers" });
      return;
    }

    if (typeof request.body?.accepted !== "boolean") {
      response.status(400).json({ success: false, error: "Invalid acknowledgement" });
      return;
    }

    try {
      await this.service.acknowledgeDeployment(
        workerId,
        deploymentId,
        request.body.accepted,
      );
      response.json({ success: true });
    } catch (error) {
      this.handleProtocolError(error, response, next);
    }
  };

  private handleProtocolError(error: unknown, response: Response, next: NextFunction) {
    if (error instanceof WorkerNotFoundError || error instanceof DeploymentNotFoundError) {
      response.status(404).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof DeploymentNotAssignedError) {
      response.status(403).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    if (error instanceof DeploymentNotScheduledError) {
      response.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      return;
    }
    next(error);
  }
}