import assert from "node:assert/strict";
import test from "node:test";
import { OllamaProvisioner } from "./ollama.provisioner.js";

const response = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as Response;

test("detects Ollama health and locally available models", async () => {
  const calls: string[] = [];
  const provisioner = new OllamaProvisioner({
    baseUrl: "http://localhost:11434",
    timeoutMs: 1000,
    fetchImpl: async (input) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path === "/api/version") return response({ version: "0.3.0" });
      return response({ models: [{ name: "qwen2.5:3b" }] });
    },
  });

  assert.deepEqual(await provisioner.health(), { available: true, version: "0.3.0" });
  assert.deepEqual(await provisioner.listModels(), [{ name: "qwen2.5:3b" }]);
  assert.deepEqual(calls, ["/api/version", "/api/tags"]);
});

test("pulls only a validated explicit model identifier", async () => {
  let body: unknown;
  const provisioner = new OllamaProvisioner({
    baseUrl: "http://localhost:11434",
    timeoutMs: 1000,
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return response({ status: "success" });
    },
  });

  await provisioner.pullModel("qwen2.5:3b");
  assert.deepEqual(body, { model: "qwen2.5:3b", stream: false });
  await assert.rejects(provisioner.pullModel("qwen2.5:3b; whoami"), /Invalid Ollama model identifier/);
});

test("reports unsupported automatic installation platforms", async () => {
  const provisioner = new OllamaProvisioner({ baseUrl: "http://localhost:11434", timeoutMs: 1000, platform: "linux" });
  await assert.rejects(provisioner.install(), /supported only on Windows and macOS/);
});
