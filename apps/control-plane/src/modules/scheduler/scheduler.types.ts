import { z } from "zod";

import type { Worker } from "../workers/worker.repository.js";

export const schedulingRequestSchema = z
  .object({
    minCpuCores: z.number().int().positive().optional(),
    minRamMb: z.number().int().positive().optional(),
    requiresGpu: z.boolean().default(false),
    minVramMb: z.number().int().nonnegative().optional(),
    architecture: z.string().trim().min(1).optional(),
    operatingSystem: z.string().trim().min(1).optional(),
  })
  .refine(
    (requirements) =>
      requirements.minCpuCores !== undefined ||
      requirements.minRamMb !== undefined ||
      requirements.requiresGpu ||
      requirements.minVramMb !== undefined ||
      requirements.architecture !== undefined ||
      requirements.operatingSystem !== undefined,
    {
      message: "At least one resource requirement must be provided",
    },
  );

export type SchedulingRequest = z.infer<typeof schedulingRequestSchema>;
export type SchedulableWorker = Pick<
  Worker,
  | "id"
  | "name"
  | "status"
  | "cpuCores"
  | "availableRamMb"
  | "gpu"
  | "vramMb"
  | "architecture"
  | "operatingSystem"
>;