import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import type { WorkerConnectionManager } from "./worker.connection-manager.js";
import type { WorkerRepository } from "./worker.repository.js";

const commandSchema = z.object({ command: z.string().trim().min(1).max(500) });

export class WorkerTerminalController {
  private readonly history = new Map<string, Array<{ requestId: string; command: string; output: { kind: string; text: string }[]; exit?: boolean; createdAt: string }>>();

  constructor(
    private readonly workers: Pick<WorkerRepository, "getWorker">,
    private readonly connection: Pick<WorkerConnectionManager, "isWorkerConnected" | "requestTerminalCommand">,
  ) {}

  execute = async (request: Request, response: Response, next: NextFunction) => {
    const workerId = request.params.workerId;
    const result = commandSchema.safeParse(request.body);
    if (typeof workerId !== "string" || !result.success) {
      response.status(400).json({ success: false, error: "A valid command is required." });
      return;
    }
    try {
      const worker = await this.workers.getWorker(workerId);
      if (!worker || worker.userId !== request.authenticatedUser?.id) {
        response.status(404).json({ success: false, error: "Worker not found." });
        return;
      }
      if (worker.status !== "ONLINE" || !this.connection.isWorkerConnected(workerId)) {
        response.status(409).json({ success: false, error: "Worker is offline." });
        return;
      }
      const requestId = randomUUID();
      const result = await this.connection.requestTerminalCommand(workerId, requestId, request.body.command);
      const entries = this.history.get(workerId) ?? [];
      entries.unshift({ requestId, command: request.body.command, output: result.output, exit: result.exit, createdAt: new Date().toISOString() });
      this.history.set(workerId, entries.slice(0, 50));
      response.json({ success: true, ...result });
    } catch (error) { next(error); }
  };

  historyForWorker = async (request: Request, response: Response) => {
    const workerId = request.params.workerId;
    if (typeof workerId !== "string") {
      response.status(400).json({ success: false, error: "Invalid worker ID" });
      return;
    }
    const worker = await this.workers.getWorker(workerId);
    if (!worker || worker.userId !== request.authenticatedUser?.id) {
      response.status(404).json({ success: false, error: "Worker not found." });
      return;
    }
    response.json({ success: true, history: this.history.get(workerId) ?? [] });
  };
}
