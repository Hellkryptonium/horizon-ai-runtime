import { z } from "zod";

export const deploymentCreationSchema = z.object({
  modelId: z.string().uuid("modelId must be a valid UUID"),
  workerId: z.string().uuid("workerId must be a valid UUID"),
  workerIds: z.array(z.string().uuid()).max(16).optional(),
  name: z.string().trim().min(1).max(255).optional(),
});

export const deploymentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255),
});

export type DeploymentCreation = z.infer<typeof deploymentCreationSchema>;