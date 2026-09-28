import type { HardwareInfo } from "../hardware/detect.js";
import type { WorkerConfig } from "../config.js";

interface RegistrationResponse {
  success: boolean;
  worker?: {
    id: string;
    credential?: string;
  };
}

export interface WorkerRegistrationResult {
  workerId: string;
  credential: string;
}

export const registerWorker = async (
  workerConfig: WorkerConfig,
  hardware: HardwareInfo,
  enrollmentToken: string,
  workerId?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WorkerRegistrationResult> => {
  const endpoint = new URL("/api/workers/enroll", `${workerConfig.controlPlaneUrl}/`);
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: enrollmentToken,
      ...(workerId ? { id: workerId } : {}),
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

  if (!result.success || !result.worker?.id || !result.worker.credential) {
    throw new Error("Worker enrollment response did not include worker credentials");
  }

  return { workerId: result.worker.id, credential: result.worker.credential };
};