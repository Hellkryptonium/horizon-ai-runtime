import type { DeploymentRepository } from "./deployments.repository.js";
import type { Deployment } from "./deployments.types.js";
import type { DeploymentCreation } from "./deployments.validation.js";
import type { WorkerRepository } from "../workers/worker.repository.js";
import type { ModelService } from "../models/models.service.js";
import type { WorkerConnectionManager } from "../workers/worker.connection-manager.js";
import { randomUUID } from "node:crypto";
import type { InferenceQueue } from "../inference/inference.queue.js";

export class DeploymentNotFoundError extends Error {
  readonly code = "DEPLOYMENT_NOT_FOUND";

  constructor() {
    super("Deployment not found.");
    this.name = "DeploymentNotFoundError";
  }
}

export class DeploymentService {
  constructor(
    private readonly modelService: Pick<ModelService, "getModel">,
    private readonly repository: DeploymentRepository,
    private readonly workers: Pick<WorkerRepository, "getWorker">,
    private readonly connectionManager: Pick<WorkerConnectionManager, "sendToWorker" | "isWorkerConnected" | "requestInference"> & {
      requestDeploymentStop?: WorkerConnectionManager["requestDeploymentStop"];
    },
    private readonly inferenceQueue?: InferenceQueue,
    private readonly replicas?: Pick<typeof import("./replica.repository.js").replicaRepository, "create" | "listForDeployment" | "claim" | "release">,
  ) {}

  async createDeployment(input: DeploymentCreation, userId: string): Promise<Deployment> {
    const model = await this.modelService.getModel(input.modelId);
    const worker = await this.workers.getWorker(input.workerId);
    if (!worker || worker.userId !== userId) throw new WorkerNotFoundError();
    if (worker.status !== "ONLINE" || !this.connectionManager.isWorkerConnected(worker.id)) {
      throw new WorkerOfflineError();
    }
    if (model.runtime !== "ollama" && model.runtime !== "docker-fastapi"
      || worker.availableRamMb < model.minRamMb
      || (model.requiresGpu && !worker.gpu)
      || (model.minVramMb !== null && (worker.vramMb ?? 0) < model.minVramMb)) {
      throw new WorkerIncompatibleError();
    }

    const deployment = await this.repository.createDeployment({
      userId,
      name: input.name ?? "Deployment",
      modelId: model.id,
      workerId: worker.id,
      status: "PENDING",
    });
    const sent = this.connectionManager.sendToWorker(worker.id, {
      type: "deployment.command",
      version: 1,
      requestId: deployment.id,
      workerId: worker.id,
      payload: { deploymentId: deployment.id, modelId: model.id, runtime: model.runtime, runtimeModelId: model.runtimeModelId },
    });
    if (!sent) {
      await this.repository.updateStatus(deployment.id, "FAILED");
      throw new WorkerOfflineError();
    }
    await this.repository.updateStatus(deployment.id, "DEPLOYING");
    if (this.replicas) {
      const workerIds = [...new Set([worker.id, ...(input.workerIds ?? [])])];
      for (const selectedWorkerId of workerIds.slice(1)) {
        const selectedWorker = await this.workers.getWorker(selectedWorkerId);
        if (!selectedWorker || selectedWorker.userId !== userId || selectedWorker.status !== "ONLINE" || !this.connectionManager.isWorkerConnected(selectedWorker.id)) {
          throw new WorkerOfflineError();
        }
        await this.replicas.create(deployment.id, selectedWorker.id);
        this.connectionManager.sendToWorker(selectedWorker.id, {
          type: "deployment.command", version: 1, requestId: deployment.id, workerId: selectedWorker.id,
          payload: { deploymentId: deployment.id, modelId: model.id, runtime: model.runtime, runtimeModelId: model.runtimeModelId },
        });
      }
    }
    return { ...deployment, status: "DEPLOYING" };
  }

  listDeployments(userId: string): Promise<Deployment[]> {
    return this.repository.listDeployments(userId);
  }

  async getDeployment(deploymentId: string, userId?: string): Promise<Deployment> {
    const deployment = await this.repository.getDeployment(deploymentId, userId);

    if (!deployment) throw new DeploymentNotFoundError();
    return deployment;
  }

  async inferDeployment(deploymentId: string, userId: string, prompt: string, requestId?: string) {
    const deployment = await this.getDeployment(deploymentId, userId);
    const worker = await this.workers.getWorker(deployment.workerId);
    if (!worker || worker.userId !== userId) throw new WorkerNotFoundError();
    if (deployment.status !== "RUNNING") throw new DeploymentNotRunningError();
    if (!this.connectionManager.isWorkerConnected(worker.id)) throw new WorkerOfflineError();

    const run = async () => {
      const selectedWorker = await this.selectReplica(deployment.id, worker);
      try {
        const result = await this.connectionManager.requestInference(selectedWorker.id, deployment.id, requestId || randomUUID(), prompt);
        if (!result.success) throw new InferenceFailedError(result.error || "Inference failed.");
        return result.response || "";
      } finally {
        await this.replicas?.release(selectedWorker.id, deployment.id);
      }
    };
    if (this.inferenceQueue) return this.inferenceQueue.enqueue({ requestId, deploymentId: deployment.id, userId, prompt, run });
    const result = await run();
    return result;
  }

  private async selectReplica(deploymentId: string, fallback: Awaited<ReturnType<WorkerRepository["getWorker"]>> extends infer T ? NonNullable<T> : never) {
    if (!this.replicas) return fallback;
    const candidates = await this.replicas.listForDeployment(deploymentId);
    for (const candidate of candidates) {
      const selected = await this.workers.getWorker(candidate.workerId);
      if (selected && selected.status === "ONLINE" && this.connectionManager.isWorkerConnected(selected.id) && (await this.replicas.claim(selected.id, deploymentId)).length) return selected;
    }
    return fallback;
  }

  async renameDeployment(deploymentId: string, userId: string, name: string) {
    const deployment = await this.repository.updateDeployment(deploymentId, userId, { name });
    if (!deployment) throw new DeploymentNotFoundError();
    return deployment;
  }

  async deleteDeployment(deploymentId: string, userId: string) {
    const deployment = await this.getDeployment(deploymentId, userId);
    if (["PENDING", "DEPLOYING", "RUNNING", "STOPPING"].includes(deployment.status)) {
      throw new DeploymentActiveError();
    }
    await this.repository.deleteDeployment(deploymentId, userId);
  }

  async stopDeployment(deploymentId: string, userId: string) {
    const deployment = await this.getDeployment(deploymentId, userId);
    if (deployment.status === "STOPPED" || deployment.status === "FAILED") return deployment;
    if (deployment.status === "STOPPING") return deployment;
    if (deployment.status !== "RUNNING") throw new DeploymentNotRunningError();
    if (!this.connectionManager.requestDeploymentStop) throw new DeploymentStopFailedError("Deployment stop is unavailable.");

    const worker = await this.workers.getWorker(deployment.workerId);
    if (!worker || worker.userId !== userId) throw new WorkerNotFoundError();
    if (!this.connectionManager.isWorkerConnected(worker.id)) throw new WorkerOfflineError();

    await this.repository.updateStatus(deployment.id, "STOPPING");
    try {
      const stopped = await this.connectionManager.requestDeploymentStop(worker.id, deployment.id, randomUUID());
      if (!stopped) throw new DeploymentStopFailedError("Worker could not stop the deployment.");
    } catch (error) {
      await this.repository.updateStatus(deployment.id, "FAILED");
      if (error instanceof DeploymentStopFailedError) throw error;
      throw new DeploymentStopFailedError(error instanceof Error ? error.message : "Deployment stop failed.");
    }

    const stopped = await this.repository.updateStatus(deployment.id, "STOPPED");
    return stopped ?? { ...deployment, status: "STOPPED" as const };
  }

  async restartDeployment(deploymentId: string, userId: string) {
    let deployment = await this.getDeployment(deploymentId, userId);
    if (deployment.status === "RUNNING") deployment = await this.stopDeployment(deploymentId, userId);
    if (!["STOPPED", "FAILED"].includes(deployment.status)) throw new DeploymentNotRunningError();

    const model = await this.modelService.getModel(deployment.modelId);
    const worker = await this.workers.getWorker(deployment.workerId);
    if (!worker || worker.userId !== userId) throw new WorkerNotFoundError();
    if (worker.status !== "ONLINE" || !this.connectionManager.isWorkerConnected(worker.id)) throw new WorkerOfflineError();
    if (model.runtime !== "ollama" && model.runtime !== "docker-fastapi"
      || worker.availableRamMb < model.minRamMb
      || (model.requiresGpu && !worker.gpu)
      || (model.minVramMb !== null && (worker.vramMb ?? 0) < model.minVramMb)) {
      throw new WorkerIncompatibleError();
    }

    const sent = this.connectionManager.sendToWorker(worker.id, {
      type: "deployment.command",
      version: 1,
      requestId: deployment.id,
      workerId: worker.id,
      payload: { deploymentId: deployment.id, modelId: model.id, runtime: model.runtime, runtimeModelId: model.runtimeModelId },
    });
    if (!sent) throw new WorkerOfflineError();
    await this.repository.updateStatus(deployment.id, "DEPLOYING");
    return { ...deployment, status: "DEPLOYING" as const };
  }
}

export class WorkerNotFoundError extends Error {
  readonly code = "WORKER_NOT_FOUND";

  constructor() {
    super("Worker not found.");
    this.name = "WorkerNotFoundError";
  }
}

export class DeploymentNotAssignedError extends Error {
  readonly code = "DEPLOYMENT_NOT_ASSIGNED_TO_WORKER";

  constructor() {
    super("Deployment is not assigned to this worker.");
    this.name = "DeploymentNotAssignedError";
  }
}

export class DeploymentNotScheduledError extends Error {
  readonly code = "DEPLOYMENT_NOT_SCHEDULED";

  constructor() {
    super("Deployment is not available for worker pickup.");
    this.name = "DeploymentNotScheduledError";
  }
}

export class WorkerDeploymentService {
  constructor(
    private readonly workers: Pick<WorkerRepository, "getWorker">,
    private readonly deployments: Pick<DeploymentRepository, "findScheduledByWorkerId" | "getDeployment">,
    private readonly models: Pick<ModelService, "getModel">,
  ) {}

  async getPendingDeploymentsForWorker(workerId: string) {
    await this.requireWorker(workerId);
    const deployments = await this.deployments.findScheduledByWorkerId(workerId);

    return Promise.all(deployments.map(async (deployment) => ({
      deployment,
      model: await this.models.getModel(deployment.modelId),
    })));
  }

  async acknowledgeDeployment(workerId: string, deploymentId: string, accepted: boolean): Promise<void> {
    await this.requireWorker(workerId);
    const deployment = await this.deployments.getDeployment(deploymentId);

    if (!deployment) throw new DeploymentNotFoundError();
    if (deployment.workerId !== workerId) throw new DeploymentNotAssignedError();
    if (deployment.status !== "SCHEDULED") throw new DeploymentNotScheduledError();
    void accepted;
  }

  private async requireWorker(workerId: string) {
    if (!(await this.workers.getWorker(workerId))) throw new WorkerNotFoundError();
  }
}

export class WorkerOfflineError extends Error {
  readonly code = "WORKER_OFFLINE";

  constructor() {
    super("Worker is not connected.");
    this.name = "WorkerOfflineError";
  }
}

export class WorkerIncompatibleError extends Error {
  readonly code = "WORKER_INCOMPATIBLE";

  constructor() {
    super("Worker does not satisfy the model requirements.");
    this.name = "WorkerIncompatibleError";
  }
}

export class DeploymentNotRunningError extends Error {
  readonly code = "DEPLOYMENT_NOT_RUNNING";

  constructor() {
    super("Deployment must be running before inference.");
    this.name = "DeploymentNotRunningError";
  }
}

export class InferenceFailedError extends Error {
  readonly code = "INFERENCE_FAILED";
}

export class DeploymentActiveError extends Error {
  readonly code = "DEPLOYMENT_ACTIVE";

  constructor() {
    super("Stop the deployment before deleting it.");
    this.name = "DeploymentActiveError";
  }
}

export class DeploymentStopFailedError extends Error {
  readonly code = "DEPLOYMENT_STOP_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "DeploymentStopFailedError";
  }
}