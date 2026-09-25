import assert from "node:assert/strict";
import test from "node:test";

import {
  detectHardware,
  normalizeArchitecture,
  normalizeOperatingSystem,
} from "./detect.js";

test("detectHardware returns normalized resource data", async () => {
  const hardware = await detectHardware();

  assert.ok(hardware.name.length > 0);
  assert.ok(Number.isInteger(hardware.cpuCores) && hardware.cpuCores > 0);
  assert.ok(Number.isInteger(hardware.totalRamMb) && hardware.totalRamMb > 0);
  assert.ok(Number.isInteger(hardware.availableRamMb) && hardware.availableRamMb >= 0);
  assert.ok(hardware.availableRamMb <= hardware.totalRamMb);
  assert.ok(hardware.gpu === null || hardware.gpu.length > 0);
  assert.ok(hardware.vramMb === null || (Number.isInteger(hardware.vramMb) && hardware.vramMb > 0));
  assert.ok(hardware.architecture.length > 0);
  assert.ok(hardware.operatingSystem.length > 0);
});

test("normalizeOperatingSystem maps supported platforms", () => {
  assert.equal(normalizeOperatingSystem("darwin"), "macos");
  assert.equal(normalizeOperatingSystem("win32"), "windows");
  assert.equal(normalizeOperatingSystem("linux"), "linux");
});

test("normalizeArchitecture preserves supported values and normalizes x32", () => {
  assert.equal(normalizeArchitecture("arm64"), "arm64");
  assert.equal(normalizeArchitecture("x64"), "x64");
  assert.equal(normalizeArchitecture("x32"), "ia32");
});