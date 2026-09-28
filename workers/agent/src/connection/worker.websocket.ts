import { randomUUID } from "node:crypto";
import WebSocket from "ws";

import type { WorkerConfig } from "../config.js";
import type { DeploymentCommand, InferenceCommand, ProvisioningCommand } from "../deployment/types.js";

const reconnectBaseMs = 1000;
const reconnectMaxMs = 30_000;

interface WorkerMessage {
  type: string;
  version: 1;
  requestId: string;
  workerId: string;
  payload: Record<string, unknown>;
}

const isWorkerMessage = (value: unknown): value is WorkerMessage => {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<WorkerMessage>;
  return message.version === 1
    && typeof message.type === "string"
    && typeof message.requestId === "string"
    && typeof message.workerId === "string"
    && Boolean(message.payload && typeof message.payload === "object");
};

const workerMessage = (type: string, workerId: string, payload: Record<string, unknown> = {}, requestId: string = randomUUID()): WorkerMessage => ({
  type,
  version: 1,
  requestId,
  workerId,
  payload,
});

const toWebSocketUrl = (controlPlaneUrl: string) => {
  const url = new URL(controlPlaneUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/worker";
  return url.toString();
};

export interface WorkerWebSocketClient {
  start(): Promise<void>;
  stop(): void;
}

export const createWorkerWebSocketClient = (
  workerConfig: WorkerConfig,
  workerId: string,
  credential: string,
  hardwareName: string,
  WebSocketImpl: typeof WebSocket = WebSocket,
  onDeploymentCommand?: (command: DeploymentCommand) => Promise<{ runtimeId?: string } | undefined>,
  onInferenceCommand?: (command: InferenceCommand) => Promise<string>,
  onProvisioningCommand?: (command: ProvisioningCommand) => Promise<Record<string, unknown>>, 
): WorkerWebSocketClient => {
  let connection: WebSocket | undefined;
  let stopped = false;
  let reconnectTimer: NodeJS.Timeout | undefined;
  let reconnectAttempt = 0;
  let resolveStart: (() => void) | undefined;

  const connect = () => {
    if (stopped) return;
    connection = new WebSocketImpl(toWebSocketUrl(workerConfig.controlPlaneUrl), {
      headers: { authorization: `Bearer ${credential}` },
    });

    connection.on("open", () => {
      reconnectAttempt = 0;
      connection?.send(JSON.stringify(workerMessage("worker.hello", workerId, { name: hardwareName })));
      resolveStart?.();
      resolveStart = undefined;
    });
    connection.on("message", (raw) => {
      let message: WorkerMessage;
      try {
        message = JSON.parse(raw.toString()) as WorkerMessage;
      } catch {
        connection?.close(1003, "Malformed JSON");
        return;
      }
      if (!isWorkerMessage(message) || message.workerId !== workerId) {
        connection?.close(1008, "Invalid worker message");
        return;
      }
      if (message.type === "worker.ping") {
        connection?.send(JSON.stringify(workerMessage("worker.pong", workerId)));
      }
      if (message.type === "deployment.command" && onDeploymentCommand) {
        if (!isDeploymentCommand(message)) {
          connection?.close(1008, "Invalid deployment command");
          return;
        }
        void onDeploymentCommand(message).then((result) => {
          connection?.send(JSON.stringify(workerMessage("deployment.result", workerId, {
            deploymentId: message.payload.deploymentId,
            success: Boolean(result),
            ...(result?.runtimeId ? { runtimeId: result.runtimeId } : {}),
          }, message.requestId)));
        }).catch((error: unknown) => {
          connection?.send(JSON.stringify(workerMessage("deployment.result", workerId, {
            deploymentId: message.payload.deploymentId,
            success: false,
            error: error instanceof Error ? error.message : "Deployment failed",
          }, message.requestId)));
        });
      }
      if (message.type === "inference.command" && onInferenceCommand) {
        if (!isInferenceCommand(message)) {
          connection?.close(1008, "Invalid inference command");
          return;
        }
        void onInferenceCommand(message).then((response) => {
          connection?.send(JSON.stringify(workerMessage("inference.result", workerId, {
            deploymentId: message.payload.deploymentId,
            success: true,
            response,
          }, message.requestId)));
        }).catch((error: unknown) => {
          connection?.send(JSON.stringify(workerMessage("inference.result", workerId, {
            deploymentId: message.payload.deploymentId,
            success: false,
            error: error instanceof Error ? error.message : "Inference failed",
          }, message.requestId)));
        });
      }
      if (isProvisioningCommand(message) && onProvisioningCommand) {
        void onProvisioningCommand(message).then((data) => {
          connection?.send(JSON.stringify(workerMessage("provisioning.result", workerId, {
            operation: message.type,
            success: true,
            data,
          }, message.requestId)));
        }).catch((error: unknown) => {
          connection?.send(JSON.stringify(workerMessage("provisioning.result", workerId, {
            operation: message.type,
            success: false,
            error: error instanceof Error ? error.message : "Provisioning failed",
          }, message.requestId)));
        });
      }
    });
    connection.on("close", () => {
      connection = undefined;
      if (stopped) return;
      const delay = Math.min(reconnectBaseMs * (2 ** reconnectAttempt), reconnectMaxMs);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    });
    connection.on("error", () => undefined);
  };

  return {
    start() {
      stopped = false;
      connect();
      return new Promise<void>((resolve) => { resolveStart = resolve; });
    },
    stop() {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      connection?.close();
      connection = undefined;
    },
  };
};

const isDeploymentCommand = (message: WorkerMessage): message is WorkerMessage & DeploymentCommand => (
  message.type === "deployment.command"
  && uuidPattern.test(String(message.payload.deploymentId))
  && uuidPattern.test(String(message.payload.modelId))
  && message.payload.runtime === "ollama"
);

const isInferenceCommand = (message: WorkerMessage): message is WorkerMessage & InferenceCommand => (
  message.type === "inference.command"
  && uuidPattern.test(String(message.payload.deploymentId))
  && typeof message.payload.prompt === "string"
  && message.payload.prompt.trim().length > 0
);

const isProvisioningCommand = (message: WorkerMessage): message is WorkerMessage & ProvisioningCommand => (
  ["runtime.health", "runtime.install", "model.status", "model.pull"].includes(message.type)
  && (message.type !== "model.pull" || (typeof message.payload.modelId === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/.test(message.payload.modelId)))
);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
