import assert from "node:assert/strict";
import test from "node:test";
import { FakeRuntimeAdapter } from "../runtime/fake.runtime.js";
import { RuntimeManager } from "../runtime/runtime.manager.js";
import { RuntimeRegistry } from "../runtime/runtime.registry.js";
import { executeWorkerCommand } from "./commands.js";
import type { HardwareInfo } from "../hardware/detect.js";

const hardware: HardwareInfo = {
  name: "test-worker",
  cpuCores: 8,
  totalRamMb: 16_000,
  availableRamMb: 8_000,
  operatingSystem: "test",
  architecture: "x64",
  gpu: null,
  vramMb: null,
};

const context = () => ({
  workerId: "worker-1",
  hardware,
  connected: () => true,
  runtime: new RuntimeManager(new RuntimeRegistry().register("fake", new FakeRuntimeAdapter())),
});

test("lists registered runtimes and reports worker status", async () => {
  const result = await executeWorkerCommand("status", context());
  assert.equal(result.exit, false);
  assert.match(result.output[0]?.text ?? "", /Worker-1|Worker\s+worker-1/);
  assert.match(result.output[0]?.text ?? "", /fake/);

  const runtimes = await executeWorkerCommand("runtime list", context());
  assert.equal(runtimes.output[0]?.text, "- fake");
});

test("rejects malformed commands with a useful hint", async () => {
  const result = await executeWorkerCommand("model pull", context());
  assert.equal(result.output[0]?.kind, "error");
  assert.match(result.output[0]?.text ?? "", /Unknown command|help/);
});