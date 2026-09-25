import type { WorkerRepository } from "../workers/worker.repository.js";
import type { SchedulingRequest, SchedulableWorker } from "./scheduler.types.js";

export class NoCompatibleWorkerError extends Error {
  readonly code = "NO_COMPATIBLE_WORKER";

  constructor() {
    super("No online worker satisfies the requested resources.");
    this.name = "NoCompatibleWorkerError";
  }
}

const isCompatible = (worker: SchedulableWorker, requirements: SchedulingRequest) => {
  if (worker.status !== "ONLINE") return false;
  if (requirements.minCpuCores !== undefined && worker.cpuCores < requirements.minCpuCores) return false;
  if (
    requirements.minRamMb !== undefined &&
    worker.availableRamMb < requirements.minRamMb
  ) {
    return false;
  }
  if (requirements.requiresGpu && worker.gpu === null) return false;
  if (
    requirements.minVramMb !== undefined &&
    (worker.vramMb === null || worker.vramMb < requirements.minVramMb)
  ) {
    return false;
  }
  if (requirements.architecture !== undefined && worker.architecture !== requirements.architecture) {
    return false;
  }
  if (
    requirements.operatingSystem !== undefined &&
    worker.operatingSystem !== requirements.operatingSystem
  ) {
    return false;
  }

  return true;
};

const compareNullableDescending = (left: number | null, right: number | null) => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
};

const compareWorkers = (left: SchedulableWorker, right: SchedulableWorker) => {
  const ramOrder = right.availableRamMb - left.availableRamMb;
  if (ramOrder !== 0) return ramOrder;

  const vramOrder = compareNullableDescending(left.vramMb, right.vramMb);
  if (vramOrder !== 0) return vramOrder;

  const cpuOrder = right.cpuCores - left.cpuCores;
  if (cpuOrder !== 0) return cpuOrder;

  return left.id.localeCompare(right.id);
};

export class SchedulerService {
  constructor(private readonly repository: Pick<WorkerRepository, "listWorkers">) {}

  async scheduleWorkload(requirements: SchedulingRequest): Promise<SchedulableWorker> {
    const workers = await this.repository.listWorkers();
    const compatibleWorkers = workers
      .filter((worker) => isCompatible(worker, requirements))
      .sort(compareWorkers);
    const selectedWorker = compatibleWorkers[0];

    if (!selectedWorker) throw new NoCompatibleWorkerError();
    return selectedWorker;
  }
}