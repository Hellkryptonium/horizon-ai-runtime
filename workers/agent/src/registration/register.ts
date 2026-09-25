import type { HardwareInfo } from "../hardware/detect.js";
import type { WorkerConfig } from "../config.js";

interface RegistrationResponse {
  success: boolean;
  worker?: {
    id: string;
  };
}

export const registerWorker = async (
  workerConfig: WorkerConfig,
  hardware: HardwareInfo,
): Promise<string> => {
  const endpoint = new URL("/api/workers/register", `${workerConfig.controlPlaneUrl}/`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...hardware,
      name: workerConfig.workerName || hardware.name,
    }),
  });

  if (!response.ok) {
    throw new Error(`Worker registration failed with HTTP ${response.status}`);
  }

  let result: RegistrationResponse;

  try {
    result = (await response.json()) as RegistrationResponse;
  } catch {
    throw new Error("Worker registration returned an invalid response");
  }

  if (!result.success || !result.worker?.id) {
    throw new Error("Worker registration response did not include a worker ID");
  }

  return result.worker.id;
};