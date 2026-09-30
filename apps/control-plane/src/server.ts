import { createApp } from "./app.js";
import { env } from "./config/env.js";
import "./db/client.js";
import { createServer } from "node:http";
import { workerRepository } from "./modules/workers/worker.repository.js";
import { WorkerConnectionManager } from "./modules/workers/worker.connection-manager.js";
import { deploymentRepository } from "./modules/deployments/deployments.repository.js";
import { WorkerService } from "./modules/workers/worker.service.js";
import { startWorkerStaleMonitor } from "./modules/workers/worker.monitor.js";
import { auditLegacyOwnership } from "./db/ownership-audit.js";

const connectionManager = new WorkerConnectionManager(workerRepository, deploymentRepository);
const stopWorkerStaleMonitor = startWorkerStaleMonitor(new WorkerService(workerRepository));
const app = createApp(workerRepository, undefined, undefined, deploymentRepository, undefined, undefined, connectionManager);
const server = createServer(app);
connectionManager.attach(server);
void auditLegacyOwnership().then((audit) => {
  if (audit.unownedDeployments || audit.unownedWorkers) console.warn("Legacy ownership records detected:", audit);
}).catch((error) => console.error("Ownership audit failed:", error));
void workerRepository.listWorkers().then((workers) => Promise.all(
  workers.filter((worker) => worker.status === "OFFLINE").map((worker) => deploymentRepository.markActiveByWorkerId(worker.id, "FAILED")),
)).catch((error) => console.error("Startup worker scan failed:", error));

server.on("error", (error) => {
	console.error(`Control plane could not listen on port ${env.PORT}:`, error);
});

server.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Horizon control plane listening on port ${env.PORT}`);
});
