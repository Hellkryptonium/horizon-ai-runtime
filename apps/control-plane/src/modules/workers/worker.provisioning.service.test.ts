import { describe, expect, it } from "vitest";
import {
  ProvisioningOwnershipError,
  ProvisioningWorkerOfflineError,
  WorkerProvisioningService,
} from "./worker.provisioning.service.js";
import type { ProvisioningOperation } from "./worker.protocol.js";

const workerId = "00000000-0000-4000-8000-000000000001";
const worker = { id: workerId, userId: "user-1", status: "ONLINE" as "ONLINE" | "OFFLINE" };

const service = (current = worker, connected = true) => new WorkerProvisioningService(
  { getWorker: async () => current } as never,
  { isWorkerConnected: () => connected, requestProvisioning: async (_workerId: string, _requestId: string, operation: ProvisioningOperation) => ({ operation }) } as never,
);

describe("worker provisioning service", () => {
  it("rejects provisioning for a worker owned by another user", async () => {
    await expect(service().request("user-2", workerId, "runtime.health")).rejects.toBeInstanceOf(ProvisioningOwnershipError);
  });

  it("rejects provisioning when the worker is offline or disconnected", async () => {
    await expect(service({ ...worker, status: "OFFLINE" }, false).request("user-1", workerId, "runtime.health")).rejects.toBeInstanceOf(ProvisioningWorkerOfflineError);
  });

  it("delivers a fixed provisioning operation", async () => {
    await expect(service().request("user-1", workerId, "model.pull", "qwen2.5:3b")).resolves.toEqual({ operation: "model.pull" });
  });
});
