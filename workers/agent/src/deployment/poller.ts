import type { WorkerConfig } from "../config.js";
import type { DeploymentPoller, PendingDeployment, PendingDeploymentsResponse } from "./types.js";

const deploymentPollIntervalMs = 10_000;
type Fetch = typeof fetch;

export const createDeploymentPoller = (
  workerConfig: WorkerConfig,
  workerId: string,
  fetchImpl: Fetch = fetch,
  log: (message: string) => void = console.log,
  errorLog: (message: string) => void = console.error,
  onDeployment?: (deployment: PendingDeployment) => Promise<void>,
): DeploymentPoller => {
  let timer: NodeJS.Timeout | undefined;
  let polling = false;

  const pollNow = async () => {
    if (polling) return;
    polling = true;

    try {
      log("[deployment] polling for pending deployments");
      const endpoint = new URL(`/api/workers/${workerId}/deployments/pending`, `${workerConfig.controlPlaneUrl}/`);
      const response = await fetchImpl(endpoint);
      if (!response.ok) throw new Error(`Deployment polling failed with HTTP ${response.status}`);

      const body = (await response.json()) as PendingDeploymentsResponse;
      for (const deployment of body.deployments) {
        log(`[deployment] received deployment ${deployment.deploymentId}`);
        await acknowledge(workerConfig, workerId, deployment.deploymentId, fetchImpl, log);
        await onDeployment?.(deployment);
      }
    } catch (error: unknown) {
      errorLog(`[deployment] polling failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      polling = false;
    }
  };

  return {
    pollNow,
    start() {
      if (timer) return;
      void pollNow();
      timer = setInterval(() => void pollNow(), deploymentPollIntervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    },
  };
};

const acknowledge = async (
  workerConfig: WorkerConfig,
  workerId: string,
  deploymentId: string,
  fetchImpl: Fetch,
  log: (message: string) => void,
) => {
  log(`[deployment] acknowledging deployment ${deploymentId}`);
  const endpoint = new URL(
    `/api/workers/${workerId}/deployments/${deploymentId}/ack`,
    `${workerConfig.controlPlaneUrl}/`,
  );
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accepted: true }),
  });
  if (!response.ok) throw new Error(`Deployment acknowledgement failed with HTTP ${response.status}`);
};
