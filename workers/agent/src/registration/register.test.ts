import assert from "node:assert/strict";
import test from "node:test";

import type { WorkerConfig } from "../config.js";
import type { HardwareInfo } from "../hardware/detect.js";
import { registerWorker } from "./register.js";

const config: WorkerConfig = {
  controlPlaneUrl: "http://localhost:4000",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaRequestTimeoutMs: 1000,
  dockerRequestTimeoutMs: 1000,
  dockerRuntimeHost: "127.0.0.1",
  dockerApprovedImages: "horizon/ml-sentiment:0.1",
  heartbeatIntervalMs: 1000,
  identityFilePath: "worker.json",
};

const hardware: HardwareInfo = {
  name: "test-machine",
  cpuCores: 8,
  totalRamMb: 16000,
  availableRamMb: 12000,
  gpu: null,
  vramMb: null,
  architecture: "x64",
  operatingSystem: "windows",
};

test("enrolls with the token, persistent ID, and detected hardware", async () => {
  let request: Request | undefined;
  const fetchImpl = async (_input: URL | RequestInfo, init?: RequestInit) => {
    request = new Request("http://localhost:4000/api/workers/enroll", init);
    return new Response(JSON.stringify({ success: true, worker: { id: "worker-id", credential: "hzn_worker_secret" } }), { status: 201 });
  };

  const workerId = await registerWorker(config, hardware, "hzn_enroll_secret", "00000000-0000-4000-8000-000000000020", fetchImpl);

  assert.deepEqual(workerId, { workerId: "worker-id", credential: "hzn_worker_secret" });
  assert.equal(request?.url, "http://localhost:4000/api/workers/enroll");
  assert.deepEqual(await request?.json(), {
    token: "hzn_enroll_secret",
    id: "00000000-0000-4000-8000-000000000020",
    ...hardware,
    name: "test-machine",
  });
});
