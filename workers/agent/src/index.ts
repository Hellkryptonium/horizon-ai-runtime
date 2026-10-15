import { config } from "./config.js";
import { detectHardware } from "./hardware/detect.js";
import { loadWorkerCredential, loadWorkerId, saveWorkerIdentity } from "./identity/identity.js";
import { registerWorker } from "./registration/register.js";
import { createWorkerWebSocketClient } from "./connection/worker.websocket.js";
import { DeploymentHandler } from "./deployment/handler.js";
import { FakeRuntimeAdapter } from "./runtime/fake.runtime.js";
import { RuntimeManager } from "./runtime/runtime.manager.js";
import { OllamaRuntimeAdapter } from "./runtime/ollama.runtime.js";
import { OllamaProvisioner } from "./runtime/ollama.provisioner.js";
import { DockerFastApiRuntimeAdapter, parseApprovedDockerImages } from "./runtime/docker-fastapi.runtime.js";
import { RuntimeRegistry } from "./runtime/runtime.registry.js";
import { createHeartbeatClient } from "./heartbeat/heartbeat.js";
import { startWorkerRepl } from "./terminal/repl.js";
import { executeWorkerCommand } from "./terminal/commands.js";

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
  const savedWorkerId = await loadWorkerId(config.identityFilePath);
  const savedCredential = await loadWorkerCredential(config.identityFilePath);
  let workerId = savedWorkerId;
  let credential = savedCredential;
  let reconnected = Boolean(workerId && credential);

  if (!workerId || !credential || (config.forceReenrollment && config.enrollmentToken)) {
    if (!config.enrollmentToken) {
      throw new Error("WORKER_ENROLLMENT_TOKEN is required for first enrollment");
    }
    const registration = await registerWorker(config, hardware, config.enrollmentToken, workerId ?? undefined);
    workerId = registration.workerId;
    credential = registration.credential;
    await saveWorkerIdentity(config.identityFilePath, workerId, credential);
    reconnected = false;
  }

  const ollama = new OllamaRuntimeAdapter({
      baseUrl: config.ollamaBaseUrl,
      timeoutMs: config.ollamaRequestTimeoutMs,
    });
  const registry = new RuntimeRegistry()
    .register("fake", new FakeRuntimeAdapter())
    .register("ollama", ollama, new OllamaProvisioner({
      baseUrl: config.ollamaBaseUrl,
      timeoutMs: config.ollamaRequestTimeoutMs,
      log: console.log,
    }))
    .register("docker-fastapi", new DockerFastApiRuntimeAdapter({
      baseUrl: config.dockerFastApiUrl ?? "http://127.0.0.1:8000",
      approvedImages: parseApprovedDockerImages(config.dockerApprovedImages),
      timeoutMs: config.dockerRequestTimeoutMs,
    }));
  const runtimeManager = new RuntimeManager(registry);
  const deploymentHandler = new DeploymentHandler(runtimeManager);
  const websocket = createWorkerWebSocketClient(
    config,
    workerId,
    credential,
    hardware.name,
    undefined,
    (command) => deploymentHandler.handleCommand(command).then((handle) => handle ? { runtimeId: handle.runtimeId } : undefined),
    (command) => deploymentHandler.handleInferenceCommand(command),
    (command) => runtimeManager.provision("ollama", command.type, command.payload.modelId).then((result) => result as Record<string, unknown>),
    (command) => deploymentHandler.handleStopCommand(command),
    (command) => executeWorkerCommand(command.payload.command, { workerId, hardware, connected: () => Boolean(websocket.isConnected?.()), runtime: runtimeManager }),
  );
  await websocket.start();
  const heartbeat = createHeartbeatClient(config, undefined, config.interactive ? {
    log: () => undefined,
    error: (message) => process.stderr.write(`\n[heartbeat] ${message}\n`),
  } : undefined);
  heartbeat.start(workerId);
  printWorkerSummary(workerId, hardware);
  console.log(`${reconnected ? "Reconnected" : "Registered"} successfully.`);

  const shutdown = () => {
    heartbeat.stop();
    websocket.stop();
    console.log("Worker agent shutting down...");
    process.exit(0);
  };

  if (config.interactive) {
    void startWorkerRepl({
      workerId,
      hardware,
      connected: () => Boolean(websocket.isConnected?.()),
      runtime: runtimeManager,
    }).then(shutdown);
  }

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