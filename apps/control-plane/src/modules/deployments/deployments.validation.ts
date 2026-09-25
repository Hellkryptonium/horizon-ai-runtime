import { z } from "zod";

export const deploymentCreationSchema = z.object({
  modelId: z.string().uuid("modelId must be a valid UUID"),
});

export type DeploymentCreation = z.infer<typeof deploymentCreationSchema>;