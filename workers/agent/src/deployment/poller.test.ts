import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDeploymentPoller } from "./poller.js";
import type { WorkerConfig } from "../config.js";

const workerId = "00000000-0000-4000-8000-000000000001";
const deploymentId = "00000000-0000-4000-8000-000000000002";
const config: WorkerConfig = {
  controlPlaneUrl: "http://localhost:3000",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaRequestTimeoutMs: 30_000,
  heartbeatIntervalMs: 10_000,
  identityFilePath: "worker.json",
};

const response = (body: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => body,
}) as Response;

describe("deployment poller", () => {
  it("polls the persistent worker endpoint and acknowledges received deployments", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const logs: string[] = [];
    let handledDeploymentId: string | undefined;
    const poller = createDeploymentPoller(config, workerId, async (url, init) => {
      calls.push({ url: String(url), init });
      return calls.length === 1
        ? response({ success: true, deployments: [{ deploymentId, modelId: "model", workerId, status: "SCHEDULED" }] })
        : response({ success: true });
    }, (message) => logs.push(message), console.error, async (deployment) => {
      handledDeploymentId = deployment.deploymentId;
    });

    await poller.pollNow();

    assert.equal(calls[0]?.url, `http://localhost:3000/api/workers/${workerId}/deployments/pending`);
    assert.equal(calls[1]?.url, `http://localhost:3000/api/workers/${workerId}/deployments/${deploymentId}/ack`);
    assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), { accepted: true });
    assert.ok(logs.includes(`[deployment] received deployment ${deploymentId}`));
    assert.equal(handledDeploymentId, deploymentId);
  });

  it("does nothing for an empty response", async () => {
    let callCount = 0;
    const poller = createDeploymentPoller(config, workerId, async () => {
      callCount += 1;
      return response({ success: true, deployments: [] });
    });

    await poller.pollNow();
    assert.equal(callCount, 1);
  });

  it("handles polling failures without rejecting", async () => {
    const errors: string[] = [];
    const poller = createDeploymentPoller(config, workerId, async () => response({}, false), undefined, (message) => errors.push(message));

    await poller.pollNow();
    assert.match(errors[0] ?? "", /HTTP 500/);
  });

  it("does not overlap requests", async () => {
    let release: (() => void) | undefined;
    let callCount = 0;
    const poller = createDeploymentPoller(config, workerId, async () => {
      callCount += 1;
      await new Promise<void>((resolve) => { release = resolve; });
      return response({ success: true, deployments: [] });
    });

    const first = poller.pollNow();
    const second = poller.pollNow();
    assert.equal(callCount, 1);
    release?.();
    await Promise.all([first, second]);
  });
});
