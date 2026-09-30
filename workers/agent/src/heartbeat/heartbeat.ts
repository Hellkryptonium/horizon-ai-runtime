import type { WorkerConfig } from "../config.js";
import {
  detectDynamicResources,
  type DynamicHardwareInfo,
} from "../hardware/detect.js";

export class WorkerNotFoundError extends Error {
  constructor() {
    super("Worker no longer exists in the control plane");
    this.name = "WorkerNotFoundError";
  }
}

export interface HeartbeatClient {
  sendNow(workerId: string): Promise<void>;
  start(workerId: string, sendImmediately?: boolean): void;
  stop(): void;
}

export interface HeartbeatLogger {
  log(message: string): void;
  error(message: string): void;
}

export const sendHeartbeat = async (
  workerConfig: WorkerConfig,
  workerId: string,
  resources: DynamicHardwareInfo,
  logger: HeartbeatLogger = console,
): Promise<void> => {
  const endpoint = new URL(`/api/workers/${workerId}/heartbeat`, `${workerConfig.controlPlaneUrl}/`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(resources),
  });

  if (response.status === 404) {
    throw new WorkerNotFoundError();
  }

  if (!response.ok) {
    throw new Error(`Heartbeat failed with HTTP ${response.status}`);
  }

  logger.log(`Heartbeat OK | RAM: ${resources.availableRamMb} MB`);
};

export const createHeartbeatClient = (
  workerConfig: WorkerConfig,
  detectResources = detectDynamicResources,
  logger: HeartbeatLogger = console,
): HeartbeatClient => {
  let timer: NodeJS.Timeout | undefined;

  const sendNow = async (workerId: string) => {
    const resources = await detectResources();
    await sendHeartbeat(workerConfig, workerId, resources, logger);
  };

  const start = (workerId: string, sendImmediately = true) => {
    if (sendImmediately) {
      void sendNow(workerId).catch((error: unknown) => {
        logger.error(`Heartbeat failed: ${error instanceof Error ? error.message : "Unknown error"}. Will retry on next interval.`);
      });
    }

    timer = setInterval(() => {
      void sendNow(workerId).catch((error: unknown) => {
        logger.error(`Heartbeat failed: ${error instanceof Error ? error.message : "Unknown error"}. Will retry on next interval.`);
      });
    }, workerConfig.heartbeatIntervalMs);
  };

  return {
    sendNow,
    start,
    stop() {
      if (timer) clearInterval(timer);
    },
  };
};
