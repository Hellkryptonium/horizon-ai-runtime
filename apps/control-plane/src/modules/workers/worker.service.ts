import { z } from "zod";

import type { Worker, WorkerRepository } from "./worker.repository.js";

export const workerHeartbeatSchema = z.object({
  availableRamMb: z.number().int().nonnegative("availableRamMb must be non-negative"),
  gpu: z.string().trim().min(1).nullable().optional(),
  vramMb: z.number().int().nonnegative("vramMb must be non-negative").nullable().optional(),
});

export type WorkerHeartbeat = z.infer<typeof workerHeartbeatSchema>;

export const workerRegistrationSchema = z
  .object({
    name: z.string().trim().min(1, "name is required"),
    cpuCores: z.number().int().positive("cpuCores must be a positive integer"),
    totalRamMb: z.number().int().positive("totalRamMb must be a positive integer"),
    availableRamMb: z.number().int().nonnegative("availableRamMb must be non-negative"),
    gpu: z.string().trim().min(1).nullable().optional(),
    vramMb: z.number().int().nonnegative("vramMb must be non-negative").nullable().optional(),
    architecture: z.string().trim().min(1, "architecture is required"),
    operatingSystem: z.string().trim().min(1, "operatingSystem is required"),
  })
  .refine((worker) => worker.availableRamMb <= worker.totalRamMb, {
    path: ["availableRamMb"],
    message: "availableRamMb cannot exceed totalRamMb",
  });

export type WorkerRegistration = z.infer<typeof workerRegistrationSchema>;

export class WorkerService {
  constructor(private readonly repository: WorkerRepository) {}

  registerWorker(input: WorkerRegistration): Promise<Worker> {
    return this.repository.createWorker({
      ...input,
      gpu: input.gpu ?? null,
      vramMb: input.vramMb ?? null,
      status: "ONLINE",
      lastHeartbeat: new Date(),
    });
  }

  listWorkers(): Promise<Worker[]> {
    return this.repository.listWorkers();
  }

  heartbeat(workerId: string, input: WorkerHeartbeat): Promise<Worker | undefined> {
    return this.repository.updateHeartbeat(workerId, input);
  }

  markStaleWorkers(now = new Date(), staleAfterMs = 30_000): Promise<Worker[]> {
    return this.repository.markStaleWorkers(new Date(now.getTime() - staleAfterMs));
  }
}