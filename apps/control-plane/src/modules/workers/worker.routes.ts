import { Router } from "express";

import type { WorkerRepository } from "./worker.repository.js";
import { workerEnrollmentRepository, type WorkerEnrollmentRepository } from "./enrollment.repository.js";
import { WorkerController } from "./worker.controller.js";
import { WorkerService } from "./worker.service.js";
import { WorkerEnrollmentService } from "./enrollment.service.js";
import { WorkerDeploymentController } from "../deployments/deployments.controller.js";
import type { WorkerDeploymentService } from "../deployments/deployments.service.js";
import { requireAuth } from "../../middleware/auth.js";
import { AuthService } from "../auth/auth.service.js";
import type { WorkerConnectionManager } from "./worker.connection-manager.js";
import type { DeploymentRepository } from "../deployments/deployments.repository.js";
import { WorkerProvisioningController } from "./worker.provisioning.controller.js";
import { WorkerProvisioningService } from "./worker.provisioning.service.js";
import { WorkerTerminalController } from "./worker.terminal.controller.js";

export const createWorkerRouter = (
  repository: WorkerRepository,
  auth: AuthService,
  deploymentService?: WorkerDeploymentService,
  enrollmentRepository: WorkerEnrollmentRepository = workerEnrollmentRepository,
  connectionManager?: Pick<WorkerConnectionManager, "isWorkerConnected" | "requestProvisioning" | "requestTerminalCommand">,
  deployments?: Pick<DeploymentRepository, "hasActiveByWorkerId">,
) => {
  const router = Router();
  const controller = new WorkerController(new WorkerService(repository, deployments), new WorkerEnrollmentService(enrollmentRepository, repository));

  router.post("/enrollment", requireAuth(auth), controller.createEnrollment);
  router.post("/enroll", controller.enroll);
  router.post("/:workerId/heartbeat", controller.heartbeat);
  router.get("/", requireAuth(auth), controller.list);
  router.delete("/:workerId", requireAuth(auth), controller.revoke);

  if (deploymentService) {
    const deploymentController = new WorkerDeploymentController(deploymentService);
    router.get("/:workerId/deployments/pending", deploymentController.pending);
    router.post("/:workerId/deployments/:deploymentId/ack", deploymentController.acknowledge);
  }

  if (connectionManager) {
    const provisioning = new WorkerProvisioningController(new WorkerProvisioningService(repository, connectionManager));
    router.get("/:workerId/runtime/health", requireAuth(auth), provisioning.health);
    router.post("/:workerId/runtime/install", requireAuth(auth), provisioning.install);
    router.get("/:workerId/models/status", requireAuth(auth), provisioning.models);
    router.post("/:workerId/models/pull", requireAuth(auth), provisioning.pull);
    const terminal = new WorkerTerminalController(repository, connectionManager);
    router.post("/:workerId/terminal", requireAuth(auth), terminal.execute);
    router.get("/:workerId/terminal/history", requireAuth(auth), terminal.historyForWorker);
  }

  return router;
};