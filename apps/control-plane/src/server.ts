import { app } from "./app.js";
import { env } from "./config/env.js";
import "./db/client.js";
import { workerRepository } from "./modules/workers/worker.repository.js";
import { startWorkerStaleMonitor } from "./modules/workers/worker.monitor.js";
import { WorkerService } from "./modules/workers/worker.service.js";

app.listen(env.PORT, () => {
  console.log(`Horizon control plane listening on port ${env.PORT}`);
});

startWorkerStaleMonitor(new WorkerService(workerRepository));