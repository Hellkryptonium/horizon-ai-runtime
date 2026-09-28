import type { DeploymentRepository } from "./deployments.repository.js";
import type { Deployment } from "./deployments.types.js";
import type { DeploymentCreation } from "./deployments.validation.js";
import type { WorkerRepository } from "../workers/worker.repository.js";
import type { ModelService } from "../models/models.service.js";
import type { WorkerConnectionManager } from "../workers/worker.connection-manager.js";
import { randomUUID } from "node:crypto";

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
    private readonly connectionManager: Pick<WorkerConnectionManager, "sendToWorker" | "isWorkerConnected" | "requestInference">,
  ) {}

  async createDeployment(input: DeploymentCreation, userId: string): Promise<Deployment> {
    const model = await this.modelService.getModel(input.modelId);
    const worker = await this.workers.getWorker(input.workerId);
    if (!worker || worker.userId !== userId) throw new WorkerNotFoundError();
    if (worker.status !== "ONLINE" || !this.connectionManager.isWorkerConnected(worker.id)) {
      throw new WorkerOfflineError();
    }
    if (model.runtime !== "ollama"
      || worker.availableRamMb < model.minRamMb
      || (model.requiresGpu && !worker.gpu)
      || (model.minVramMb !== null && (worker.vramMb ?? 0) < model.minVramMb)) {
      throw new WorkerIncompatibleError();
    }

    const deployment = await this.repository.createDeployment({
      modelId: model.id,
      workerId: worker.id,
      status: "PENDING",
    });
    const sent = this.connectionManager.sendToWorker(worker.id, {
      type: "deployment.command",
      version: 1,
      requestId: deployment.id,
      workerId: worker.id,
      payload: { deploymentId: deployment.id, modelId: model.id, runtime: "ollama" },
    });
    if (!sent) {
      await this.repository.updateStatus(deployment.id, "FAILED");
      throw new WorkerOfflineError();
    }
    await this.repository.updateStatus(deployment.id, "DEPLOYING");
    return { ...deployment, status: "DEPLOYING" };
  }

  listDeployments(): Promise<Deployment[]> {
    return this.repository.listDeployments();
  }

  async getDeployment(deploymentId: string): Promise<Deployment> {
    const deployment = await this.repository.getDeployment(deploymentId);

    if (!deployment) throw new DeploymentNotFoundError();
    return deployment;
  }

  async inferDeployment(deploymentId: string, userId: string, prompt: string) {
    const deployment = await this.getDeployment(deploymentId);
    const worker = await this.workers.getWorker(deployment.workerId);
    if (!worker || worker.userId !== userId) throw new WorkerNotFoundError();
    if (deployment.status !== "RUNNING") throw new DeploymentNotRunningError();
    if (!this.connectionManager.isWorkerConnected(worker.id)) throw new WorkerOfflineError();

    const result = await this.connectionManager.requestInference(worker.id, deployment.id, randomUUID(), prompt);
    if (!result.success) throw new InferenceFailedError(result.error || "Inference failed.");
    return result.response || "";
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