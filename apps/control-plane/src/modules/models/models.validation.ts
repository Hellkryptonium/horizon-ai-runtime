import { z } from "zod";

export const modelCreationSchema = z
  .object({
    name: z.string().trim().min(1, "name is required"),
    version: z.string().trim().min(1, "version is required"),
    format: z.string().trim().min(1, "format is required"),
    runtime: z.string().trim().min(1, "runtime is required"),
    runtimeModelId: z.string().trim().min(1, "runtimeModelId must not be empty").nullable().optional(),
    sizeMb: z.number().int().positive("sizeMb must be a positive integer"),
    minRamMb: z.number().int().positive("minRamMb must be a positive integer"),
    minVramMb: z.number().int().nonnegative("minVramMb must be non-negative").nullable().optional(),
    requiresGpu: z.boolean().default(false),
    modelArchitecture: z.string().trim().min(1, "modelArchitecture is required"),
    contextLength: z.number().int().positive("contextLength must be a positive integer").nullable().optional(),
    downloadUrl: z.string().url("downloadUrl must be a valid URL").nullable().optional(),
  })
  .strict()
  .superRefine((model, context) => {
    if (model.requiresGpu && model.minVramMb == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minVramMb"],
        message: "minVramMb is required when requiresGpu is true",
      });
    }
  });

export type ModelCreation = z.infer<typeof modelCreationSchema>;