import { createServer } from "node:http";
import { WebSocket } from "ws";
import { describe, expect, it } from "vitest";

import { hashWorkerCredential } from "./enrollment.service.js";
import { WorkerConnectionManager } from "./worker.connection-manager.js";
import type { Worker, WorkerRepository } from "./worker.repository.js";

const workerId = "00000000-0000-4000-8000-000000000020";
const credential = "hzn_worker_test_secret";

const workerRecord = (): Worker => ({
  id: workerId,
  userId: "00000000-0000-4000-8000-000000000010",
  credentialHash: hashWorkerCredential(credential),
  name: "test-worker",
  status: "OFFLINE",
  cpuCores: 8,
  totalRamMb: 16000,
  availableRamMb: 12000,
  gpu: null,
  vramMb: null,
  architecture: "x64",
  operatingSystem: "windows",
  lastHeartbeat: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const waitFor = async (predicate: () => boolean, timeoutMs = 1000) => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for WebSocket state");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const createHarness = async () => {
  const worker = workerRecord();
  const statuses: string[] = [];
  const repository = {
    async getWorkerByCredentialHash(hash: string) { return hash === worker.credentialHash ? worker : undefined; },
    async updateConnectionStatus(_workerId: string, status: "ONLINE" | "OFFLINE") { worker.status = status; statuses.push(status); return worker; },
  } as Pick<WorkerRepository, "getWorkerByCredentialHash" | "updateConnectionStatus"> as WorkerRepository;
  const server = createServer();
  const manager = new WorkerConnectionManager(repository);
  manager.attach(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  return { server, manager, worker, statuses, url: `ws://127.0.0.1:${address.port}/ws/worker` };
};

const closeHarness = async (harness: Awaited<ReturnType<typeof createHarness>>) => {
  harness.manager.close();
  await new Promise<void>((resolve) => harness.server.close(() => resolve()));
};

describe("WorkerConnectionManager", () => {
  it("authenticates, establishes ONLINE state, and marks disconnect OFFLINE", async () => {
    const harness = await createHarness();
    const socket = new WebSocket(harness.url, { headers: { authorization: `Bearer ${credential}` } });
    const messages: string[] = [];
    socket.on("message", (message) => messages.push(message.toString()));
    await new Promise<void>((resolve) => socket.once("open", () => resolve()));
    socket.send(JSON.stringify({ type: "worker.hello", version: 1, requestId: "hello-1", workerId, payload: { name: "test-worker" } }));
    await waitFor(() => harness.worker.status === "ONLINE");
    expect(messages.join(" ")).toContain("worker.hello_ack");
    socket.close();
    await waitFor(() => harness.worker.status === "OFFLINE");
    expect(harness.statuses).toEqual(["ONLINE", "OFFLINE"]);
    await closeHarness(harness);
  });

  it("rejects invalid credentials and malformed messages", async () => {
    const harness = await createHarness();
    const invalid = new WebSocket(harness.url, { headers: { authorization: "Bearer invalid" } });
    await new Promise<void>((resolve) => {
      invalid.once("close", () => resolve());
      invalid.once("error", () => resolve());
    });
    expect(harness.worker.status).toBe("OFFLINE");
    const socket = new WebSocket(harness.url, { headers: { authorization: `Bearer ${credential}` } });
    await new Promise<void>((resolve) => socket.once("open", () => resolve()));
    socket.send("not-json");
    const closeCode = await new Promise<number>((resolve) => socket.once("close", (code) => resolve(code)));
    expect(closeCode).toBe(1003);
    await closeHarness(harness);
  });

  it("replaces duplicate connections without stale OFFLINE cleanup", async () => {
    const harness = await createHarness();
    const first = new WebSocket(harness.url, { headers: { authorization: `Bearer ${credential}` } });
    await new Promise<void>((resolve) => first.once("open", () => resolve()));
    first.send(JSON.stringify({ type: "worker.hello", version: 1, requestId: "hello-1", workerId, payload: { name: "test-worker" } }));
    await waitFor(() => harness.worker.status === "ONLINE");
    const second = new WebSocket(harness.url, { headers: { authorization: `Bearer ${credential}` } });
    await new Promise<void>((resolve) => second.once("open", () => resolve()));
    second.send(JSON.stringify({ type: "worker.hello", version: 1, requestId: "hello-2", workerId, payload: { name: "test-worker" } }));
    await waitFor(() => harness.statuses.filter((status) => status === "ONLINE").length === 2);
    expect(harness.worker.status).toBe("ONLINE");
    second.close();
    await waitFor(() => harness.worker.status === "OFFLINE");
    await closeHarness(harness);
  });
});
