import { createApp } from "./app.js";
import { env } from "./config/env.js";
import "./db/client.js";
import { createServer } from "node:http";
import { workerRepository } from "./modules/workers/worker.repository.js";
import { WorkerConnectionManager } from "./modules/workers/worker.connection-manager.js";
import { deploymentRepository } from "./modules/deployments/deployments.repository.js";

const connectionManager = new WorkerConnectionManager(workerRepository, deploymentRepository);
const app = createApp(workerRepository, undefined, undefined, deploymentRepository, undefined, undefined, connectionManager);
const server = createServer(app);
connectionManager.attach(server);

server.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Horizon control plane listening on port ${env.PORT}`);
});
