import type { SchedulerService } from "../scheduler/scheduler.service.js";
import type { SchedulingRequest } from "../scheduler/scheduler.types.js";
import type { DeploymentRepository } from "./deployments.repository.js";
import type { Deployment } from "./deployments.types.js";
import type { DeploymentCreation } from "./deployments.validation.js";
import type { WorkerRepository } from "../workers/worker.repository.js";
import type { ModelService } from "../models/models.service.js";

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
    private readonly schedulerService: Pick<SchedulerService, "scheduleWorkload">,
    private readonly repository: DeploymentRepository,
  ) {}

  async createDeployment(input: DeploymentCreation): Promise<Deployment> {
    const model = await this.modelService.getModel(input.modelId);
    const requirements: SchedulingRequest = {
      minRamMb: model.minRamMb,
      minVramMb: model.minVramMb ?? undefined,
      requiresGpu: model.requiresGpu,
    };
    const worker = await this.schedulerService.scheduleWorkload(requirements);

    return this.repository.createDeployment({
      modelId: model.id,
      workerId: worker.id,
      status: "SCHEDULED",
    });
  }

  listDeployments(): Promise<Deployment[]> {
    return this.repository.listDeployments();
  }

  async getDeployment(deploymentId: string): Promise<Deployment> {
    const deployment = await this.repository.getDeployment(deploymentId);

    if (!deployment) throw new DeploymentNotFoundError();
    return deployment;
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