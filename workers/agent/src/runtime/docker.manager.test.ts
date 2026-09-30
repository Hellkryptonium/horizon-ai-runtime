import assert from "node:assert/strict";
import { it } from "node:test";
import { buildDockerCreateArgs } from "./docker.manager.js";

it("builds a restricted Docker container command without shell interpolation", () => {
  const args = buildDockerCreateArgs({
    name: "horizon-deployment-1",
    image: "horizon/ml-sentiment:0.1",
    memoryMb: 1024,
    cpuLimit: 2,
    network: "horizon-runtime",
    port: 8000,
  });

  assert.deepEqual(args, [
    "create", "--name", "horizon-deployment-1", "--publish", "127.0.0.1::8000/tcp",
    "--memory", "1024m", "--cpus", "2", "--read-only", "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges:true", "--network", "horizon-runtime",
    "--log-opt", "max-size=10m", "--log-opt", "max-file=2", "horizon/ml-sentiment:0.1",
  ]);
});
