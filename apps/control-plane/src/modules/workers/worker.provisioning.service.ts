import { randomUUID } from "node:crypto";

import type { WorkerConnectionManager } from "./worker.connection-manager.js";
import type { WorkerRepository } from "./worker.repository.js";
import type { ProvisioningOperation } from "./worker.protocol.js";

export class ProvisioningWorkerNotFoundError extends Error {
  readonly code = "WORKER_NOT_FOUND";
}

export class ProvisioningWorkerOfflineError extends Error {
  readonly code = "WORKER_OFFLINE";
}

export class ProvisioningOwnershipError extends Error {
  readonly code = "WORKER_OWNERSHIP_REQUIRED";
}

export class WorkerProvisioningService {
  constructor(
    private readonly workers: Pick<WorkerRepository, "getWorker">,
    private readonly connection: Pick<WorkerConnectionManager, "isWorkerConnected" | "requestProvisioning">,
  ) {}

  async request(userId: string, workerId: string, operation: ProvisioningOperation, modelId?: string) {
    const worker = await this.workers.getWorker(workerId);
    if (!worker) throw new ProvisioningWorkerNotFoundError();
    if (worker.userId !== userId) throw new ProvisioningOwnershipError();
    if (worker.status !== "ONLINE" || !this.connection.isWorkerConnected(workerId)) throw new ProvisioningWorkerOfflineError();
    return this.connection.requestProvisioning(workerId, randomUUID(), operation, modelId);
  }
}
