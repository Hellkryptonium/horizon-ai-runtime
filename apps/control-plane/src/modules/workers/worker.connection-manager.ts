import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

import type { WorkerRepository } from "./worker.repository.js";
import { workerMessageSchema, createWorkerMessage } from "./worker.protocol.js";
import { hashWorkerCredential } from "./enrollment.service.js";
import type { DeploymentRepository } from "../deployments/deployments.repository.js";
import type { ProvisioningOperation } from "./worker.protocol.js";

const WORKER_PATH = "/ws/worker";
const PING_INTERVAL_MS = 15_000;
const INFERENCE_TIMEOUT_MS = 60_000;

export interface InferenceResult {
  deploymentId: string;
  success: boolean;
  response?: string;
  error?: string;
}

const readBearerCredential = (request: IncomingMessage) => {
  const value = request.headers.authorization;
  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() : undefined;
};

export class WorkerConnectionManager {
  private readonly connections = new Map<string, WebSocket>();
  private readonly inferenceRequests = new Map<string, {
    resolve: (result: InferenceResult) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private readonly provisioningRequests = new Map<string, {
    resolve: (result: Record<string, unknown>) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private readonly server = new WebSocketServer({ noServer: true });
  private readonly pingTimer: NodeJS.Timeout;

  constructor(
    private readonly workers: WorkerRepository,
    private readonly deployments?: Pick<DeploymentRepository, "updateStatus">,
  ) {
    this.pingTimer = setInterval(() => this.pingConnections(), PING_INTERVAL_MS);
    this.pingTimer.unref();
  }

  attach(server: Server) {
    server.on("upgrade", (request, socket, head) => {
      if (request.url?.split("?", 1)[0] !== WORKER_PATH) {
        socket.destroy();
        return;
      }

      const credential = readBearerCredential(request);
      if (!credential) {
        socket.destroy();
        return;
      }

      void this.workers.getWorkerByCredentialHash(hashWorkerCredential(credential)).then((worker) => {
        if (!worker) {
          socket.destroy();
          return;
        }

        this.server.handleUpgrade(request, socket, head, (connection) => {
          this.handleConnection(connection, worker.id);
        });
      }).catch(() => socket.destroy());
    });
  }

  getConnection(workerId: string) {
    return this.connections.get(workerId);
  }

  isWorkerConnected(workerId: string) {
    return this.connections.get(workerId)?.readyState === WebSocket.OPEN;
  }

  sendToWorker(workerId: string, message: object) {
    const connection = this.connections.get(workerId);
    if (!connection || connection.readyState !== WebSocket.OPEN) return false;
    connection.send(JSON.stringify(message));
    return true;
  }

  requestInference(workerId: string, deploymentId: string, requestId: string, prompt: string): Promise<InferenceResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.inferenceRequests.delete(requestId);
        reject(new Error("Inference request timed out."));
      }, INFERENCE_TIMEOUT_MS);
      this.inferenceRequests.set(requestId, { resolve, reject, timer });
      if (!this.sendToWorker(workerId, {
        type: "inference.command",
        version: 1,
        requestId,
        workerId,
        payload: { deploymentId, prompt },
      })) {
        clearTimeout(timer);
        this.inferenceRequests.delete(requestId);
        reject(new Error("Worker is not connected."));
      }
    });
  }

  requestProvisioning(workerId: string, requestId: string, operation: ProvisioningOperation, modelId?: string) {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.provisioningRequests.delete(requestId);
        reject(new Error("Provisioning request timed out."));
      }, INFERENCE_TIMEOUT_MS);
      this.provisioningRequests.set(requestId, { resolve, reject, timer });
      if (!this.sendToWorker(workerId, {
        type: operation,
        version: 1,
        requestId,
        workerId,
        payload: modelId ? { modelId } : {},
      })) {
        clearTimeout(timer);
        this.provisioningRequests.delete(requestId);
        reject(new Error("Worker is not connected."));
      }
    });
  }

  close() {
    clearInterval(this.pingTimer);
    for (const connection of this.connections.values()) connection.close();
    this.connections.clear();
    this.server.close();
  }

  private handleConnection(connection: WebSocket, workerId: string) {
    const previous = this.connections.get(workerId);
    previous?.close(4000, "Replaced by a newer worker connection");
    this.connections.set(workerId, connection);
    let authenticated = false;

    connection.on("message", (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        connection.close(1003, "Malformed JSON");
        return;
      }

      const result = workerMessageSchema.safeParse(parsed);
      if (!result.success || result.data.workerId !== workerId) {
        connection.close(1008, "Invalid worker message");
        return;
      }

      if (result.data.type === "worker.hello") {
        authenticated = true;
        void this.workers.updateConnectionStatus(workerId, "ONLINE");
        connection.send(JSON.stringify(createWorkerMessage("worker.hello_ack", workerId, result.data.requestId, { connected: true })));
        return;
      }

      if (!authenticated) {
        connection.close(1008, "worker.hello required");
        return;
      }

      if (result.data.type === "worker.pong") return;
      if (result.data.type === "deployment.result") {
        void this.deployments?.updateStatus(
          result.data.requestId,
          result.data.payload.success ? "RUNNING" : "FAILED",
        );
        return;
      }
      if (result.data.type === "inference.result") {
        const pending = this.inferenceRequests.get(result.data.requestId);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.inferenceRequests.delete(result.data.requestId);
        pending.resolve(result.data.payload);
      }
      if (result.data.type === "provisioning.result") {
        const pending = this.provisioningRequests.get(result.data.requestId);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.provisioningRequests.delete(result.data.requestId);
        if (result.data.payload.success) pending.resolve(result.data.payload.data ?? {});
        else pending.reject(new Error(result.data.payload.error || "Provisioning failed."));
      }
    });

    connection.on("close", () => {
      if (this.connections.get(workerId) !== connection) return;
      this.connections.delete(workerId);
      void this.workers.updateConnectionStatus(workerId, "OFFLINE");
    });

    connection.on("error", () => connection.close());
  }

  private pingConnections() {
    for (const [workerId, connection] of this.connections) {
      if (connection.readyState !== WebSocket.OPEN) continue;
      connection.send(JSON.stringify(createWorkerMessage("worker.ping", workerId, randomUUID(), {})));
      connection.ping();
    }
  }
}
