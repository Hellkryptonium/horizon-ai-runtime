import { config } from "./config.js";
import { detectHardware } from "./hardware/detect.js";
import { createHeartbeatClient, WorkerNotFoundError } from "./heartbeat/heartbeat.js";
import { resolveWorkerIdentity } from "./identity/identity.js";
import { registerWorker } from "./registration/register.js";
import { createDeploymentPoller } from "./deployment/poller.js";
import { DeploymentHandler } from "./deployment/handler.js";
import { FakeRuntimeAdapter } from "./runtime/fake.runtime.js";
import { RuntimeManager } from "./runtime/runtime.manager.js";
import { OllamaRuntimeAdapter } from "./runtime/ollama.runtime.js";

const printWorkerSummary = (workerId: string, hardware: Awaited<ReturnType<typeof detectHardware>>) => {
  console.log("Horizon Worker Agent");
  console.log("--------------------");
  console.log(`Worker: ${config.workerName || hardware.name}`);
  console.log(`Worker ID: ${workerId}`);
  console.log(`CPU: ${hardware.cpuCores} cores`);
  console.log(`RAM: ${hardware.totalRamMb} MB`);
  console.log(`OS: ${hardware.operatingSystem}`);
  console.log(`Architecture: ${hardware.architecture}`);
  console.log(`GPU: ${hardware.gpu ?? "none detected"}`);
  console.log(`VRAM: ${hardware.vramMb ?? "unknown"} MB`);
  console.log("");
};

const main = async () => {
  const hardware = await detectHardware();
  const heartbeat = createHeartbeatClient(config);
  const resolution = await resolveWorkerIdentity({
    identityFilePath: config.identityFilePath,
    register: () => registerWorker(config, hardware),
    reconnect: (workerId) => heartbeat.sendNow(workerId),
    isWorkerNotFound: (error) => error instanceof WorkerNotFoundError,
  });

  printWorkerSummary(resolution.workerId, hardware);
  console.log(`${resolution.reconnected ? "Reconnected" : "Registered"} successfully.`);
  heartbeat.start(resolution.workerId, !resolution.reconnected);
  const runtimeManager = new RuntimeManager(new Map<string, import("./runtime/runtime.types.js").RuntimeAdapter>([
    ["fake", new FakeRuntimeAdapter()],
    ["ollama", new OllamaRuntimeAdapter({
      baseUrl: config.ollamaBaseUrl,
      timeoutMs: config.ollamaRequestTimeoutMs,
    })],
  ]));
  const deploymentHandler = new DeploymentHandler(runtimeManager);
  const deploymentPoller = createDeploymentPoller(
    config,
    resolution.workerId,
    fetch,
    console.log,
    console.error,
    (deployment) => deploymentHandler.handle(deployment).then(() => undefined),
  );
  deploymentPoller.start();

  const shutdown = () => {
    heartbeat.stop();
    deploymentPoller.stop();
    console.log("Worker agent shutting down...");
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
};

main().catch((error: unknown) => {
  console.error(
    "Worker registration failed:",
    error instanceof Error ? error.message : "Unknown registration error",
  );
  process.exitCode = 1;
});