import { z } from "zod";

export const workerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("provisioning.result"),
    version: z.literal(1),
    requestId: z.string().min(1),
    workerId: z.string().uuid(),
    payload: z.object({
      operation: z.enum(["runtime.health", "runtime.install", "model.status", "model.pull"]),
      success: z.boolean(),
      data: z.record(z.unknown()).optional(),
      error: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("inference.result"),
    version: z.literal(1),
    requestId: z.string().min(1),
    workerId: z.string().uuid(),
    payload: z.object({
      deploymentId: z.string().uuid(),
      success: z.boolean(),
      response: z.string().optional(),
      error: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("deployment.result"),
    version: z.literal(1),
    requestId: z.string().min(1),
    workerId: z.string().uuid(),
    payload: z.object({
      deploymentId: z.string().uuid(),
      success: z.boolean(),
      runtimeId: z.string().optional(),
      error: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("worker.hello"),
    version: z.literal(1),
    requestId: z.string().min(1),
    workerId: z.string().uuid(),
    payload: z.object({ name: z.string().min(1) }),
  }),
  z.object({
    type: z.literal("worker.pong"),
    version: z.literal(1),
    requestId: z.string().min(1),
    workerId: z.string().uuid(),
    payload: z.object({}),
  }),
]);

export const deploymentCommandSchema = z.object({
  type: z.literal("deployment.command"),
  version: z.literal(1),
  requestId: z.string().min(1),
  workerId: z.string().uuid(),
  payload: z.object({
    deploymentId: z.string().uuid(),
    modelId: z.string().uuid(),
    runtime: z.literal("ollama"),
  }),
});

export const inferenceCommandSchema = z.object({
  type: z.literal("inference.command"),
  version: z.literal(1),
  requestId: z.string().min(1),
  workerId: z.string().uuid(),
  payload: z.object({
    deploymentId: z.string().uuid(),
    prompt: z.string().min(1),
  }),
});

export const provisioningOperationSchema = z.enum(["runtime.health", "runtime.install", "model.status", "model.pull"]);
export type ProvisioningOperation = z.infer<typeof provisioningOperationSchema>;

export type WorkerMessage = z.infer<typeof workerMessageSchema>;

export const createWorkerMessage = <T extends string, P>(type: T, workerId: string, requestId: string, payload: P) => ({
  type,
  version: 1 as const,
  requestId,
  workerId,
  payload,
});
