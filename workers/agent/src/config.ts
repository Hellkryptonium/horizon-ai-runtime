import "dotenv/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface WorkerConfig {
  controlPlaneUrl: string;
  ollamaBaseUrl: string;
  ollamaRequestTimeoutMs: number;
  workerName?: string;
  heartbeatIntervalMs: number;
  identityFilePath: string;
}

const parsePositiveInteger = (name: string, value: string | undefined, fallback: number) => {
  const parsed = value === undefined || value.trim() === "" ? fallback : Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
};

const controlPlaneUrl = process.env.CONTROL_PLANE_URL?.trim();

if (!controlPlaneUrl) {
  throw new Error("CONTROL_PLANE_URL is required");
}

try {
  const url = new URL(controlPlaneUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("CONTROL_PLANE_URL must use HTTP or HTTPS");
  }
} catch (error) {
  throw new Error(
    `CONTROL_PLANE_URL must be a valid HTTP URL: ${error instanceof Error ? error.message : "invalid URL"}`,
  );
}

const workerName = process.env.WORKER_NAME?.trim();
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434";

try {
  const url = new URL(ollamaBaseUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("OLLAMA_BASE_URL must use HTTP or HTTPS");
  }
} catch (error) {
  throw new Error(
    `OLLAMA_BASE_URL must be a valid HTTP URL: ${error instanceof Error ? error.message : "invalid URL"}`,
  );
}

export const config: WorkerConfig = {
  controlPlaneUrl: controlPlaneUrl.replace(/\/$/, ""),
  ollamaBaseUrl: ollamaBaseUrl.replace(/\/$/, ""),
  ollamaRequestTimeoutMs: parsePositiveInteger(
    "OLLAMA_REQUEST_TIMEOUT_MS",
    process.env.OLLAMA_REQUEST_TIMEOUT_MS,
    30_000,
  ),
  workerName: workerName || undefined,
  heartbeatIntervalMs: parsePositiveInteger(
    "HEARTBEAT_INTERVAL_MS",
    process.env.HEARTBEAT_INTERVAL_MS,
    10_000,
  ),
  identityFilePath: resolve(dirname(fileURLToPath(import.meta.url)), "..", ".data", "worker.json"),
};