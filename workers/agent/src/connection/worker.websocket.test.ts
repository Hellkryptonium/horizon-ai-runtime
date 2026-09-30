import assert from "node:assert/strict";
import test from "node:test";
import { WebSocketServer } from "ws";

import type { WorkerConfig } from "../config.js";
import { createWorkerWebSocketClient } from "./worker.websocket.js";

const workerId = "00000000-0000-4000-8000-000000000020";
const config: WorkerConfig = {
  controlPlaneUrl: "http://127.0.0.1:0",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaRequestTimeoutMs: 1000,
  dockerRequestTimeoutMs: 1000,
  dockerApprovedImages: "horizon/ml-sentiment:0.1",
  heartbeatIntervalMs: 1000,
  identityFilePath: "worker.json",
};

const waitFor = async (predicate: () => boolean) => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > 2000) throw new Error("Timed out waiting for WebSocket client");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

test("connects, responds to ping, and reconnects with backoff", async () => {
  const server = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const serverConfig = { ...config, controlPlaneUrl: `http://127.0.0.1:${address.port}` };
  let connections = 0;
  let pongMessages = 0;
  server.on("connection", (socket) => {
    connections += 1;
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as { type: string };
      if (message.type === "worker.hello") {
        socket.send(JSON.stringify({ type: "worker.ping", version: 1, requestId: "ping-1", workerId, payload: {} }));
        if (connections === 1) setTimeout(() => socket.close(), 20);
      }
      if (message.type === "worker.pong") pongMessages += 1;
    });
  });

  const client = createWorkerWebSocketClient(serverConfig, workerId, "hzn_worker_secret", "test-worker");
  await client.start();
  await waitFor(() => pongMessages === 1);
  await waitFor(() => connections >= 2);
  client.stop();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("executes deployment commands and returns a correlated result", async () => {
  const server = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const command = {
    type: "deployment.command", version: 1, requestId: "request-1", workerId,
    payload: { deploymentId: "00000000-0000-4000-8000-000000000021", modelId: "00000000-0000-4000-8000-000000000022", runtime: "ollama" },
  } as const;
  const results: unknown[] = [];
  server.on("connection", (socket) => {
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as { type: string };
      if (message.type === "worker.hello") socket.send(JSON.stringify(command));
      if (message.type === "deployment.result") results.push(message);
    });
  });

  const client = createWorkerWebSocketClient(
    { ...config, controlPlaneUrl: `http://127.0.0.1:${address.port}` }, workerId, "secret", "test-worker",
    undefined,
    async (received) => {
      assert.equal(received.requestId, "request-1");
      return { runtimeId: "runtime-1" };
    },
  );
  await client.start();
  await waitFor(() => results.length === 1);
  assert.deepEqual(results[0], {
    type: "deployment.result", version: 1, requestId: "request-1", workerId,
    payload: { deploymentId: command.payload.deploymentId, success: true, runtimeId: "runtime-1" },
  });
  client.stop();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("executes inference commands and returns the same request ID", async () => {
  const server = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const resultPromise = new Promise<unknown>((resolve) => {
    server.on("connection", (socket) => socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as { type: string };
      if (message.type === "worker.hello") {
        socket.send(JSON.stringify({
          type: "inference.command", version: 1, requestId: "inference-1", workerId,
          payload: { deploymentId: "00000000-0000-4000-8000-000000000021", prompt: "Hello" },
        }));
      }
      if (message.type === "inference.result") resolve(message);
    }));
  });
  const client = createWorkerWebSocketClient(
    { ...config, controlPlaneUrl: `http://127.0.0.1:${address.port}` }, workerId, "secret", "test-worker",
    undefined,
    undefined,
    async (command) => `${command.payload.prompt} response`,
  );
  await client.start();
  assert.deepEqual(await resultPromise, {
    type: "inference.result", version: 1, requestId: "inference-1", workerId,
    payload: { deploymentId: "00000000-0000-4000-8000-000000000021", success: true, response: "Hello response" },
  });
  client.stop();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("returns correlated provisioning results for fixed operations", async () => {
  const server = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const resultPromise = new Promise<unknown>((resolve) => {
    server.on("connection", (socket) => socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as { type: string };
      if (message.type === "worker.hello") {
        socket.send(JSON.stringify({ type: "runtime.health", version: 1, requestId: "provision-1", workerId, payload: {} }));
      }
      if (message.type === "provisioning.result") resolve(message);
    }));
  });
  const client = createWorkerWebSocketClient(
    { ...config, controlPlaneUrl: `http://127.0.0.1:${address.port}` }, workerId, "secret", "test-worker",
    undefined, undefined, undefined,
    async (command) => {
      assert.equal(command.type, "runtime.health");
      return { available: true, version: "0.3.0" };
    },
  );
  await client.start();
  assert.deepEqual(await resultPromise, {
    type: "provisioning.result", version: 1, requestId: "provision-1", workerId,
    payload: { operation: "runtime.health", success: true, data: { available: true, version: "0.3.0" } },
  });
  client.stop();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
