import express from "express";

import { env } from "./config/env.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { authRepository } from "./modules/auth/auth.repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { createDeploymentRouter } from "./modules/deployments/deployments.routes.js";
import { deploymentRepository, type DeploymentRepository } from "./modules/deployments/deployments.repository.js";
import { createModelRouter } from "./modules/models/models.routes.js";
import { ModelService } from "./modules/models/models.service.js";
import { createSchedulerRouter } from "./modules/scheduler/scheduler.routes.js";
import { SchedulerService } from "./modules/scheduler/scheduler.service.js";
import { createWorkerRouter } from "./modules/workers/worker.routes.js";
import { modelRepository, type ModelRepository } from "./modules/models/models.repository.js";
import { workerRepository, type WorkerRepository } from "./modules/workers/worker.repository.js";
import { workerEnrollmentRepository } from "./modules/workers/enrollment.repository.js";
import type { WorkerEnrollmentRepository } from "./modules/workers/enrollment.repository.js";
import { WorkerDeploymentService } from "./modules/deployments/deployments.service.js";
import type { WorkerConnectionManager } from "./modules/workers/worker.connection-manager.js";

export const createApp = (
	repository: WorkerRepository = workerRepository,
	models: ModelRepository = modelRepository,
	scheduler: Pick<SchedulerService, "scheduleWorkload"> = new SchedulerService(repository),
	deployments: DeploymentRepository = deploymentRepository,
	auth: AuthService = new AuthService(authRepository),
	enrollments: WorkerEnrollmentRepository = workerEnrollmentRepository,
	connectionManager?: Pick<WorkerConnectionManager, "sendToWorker" | "isWorkerConnected" | "requestInference" | "requestProvisioning">,
) => {
	const app = express();
	const modelService = new ModelService(models);
	const workerDeploymentService = new WorkerDeploymentService(repository, deployments, modelService);

	app.use(createCorsMiddleware(env.WEB_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)));
	app.use(express.json());
	app.use(healthRouter);
	app.use("/api/auth", createAuthRouter(auth));
	app.use("/api/workers", createWorkerRouter(repository, auth, workerDeploymentService, enrollments, connectionManager));
	app.use("/api/scheduler", createSchedulerRouter(repository));
	app.use("/api/models", createModelRouter(models));
	const deploymentTransport = connectionManager ?? {
		sendToWorker: () => false,
		isWorkerConnected: () => false,
		requestInference: async () => { throw new Error("Worker is not connected."); },
		requestProvisioning: async () => { throw new Error("Worker is not connected."); },
	};
	app.use("/api/deployments", createDeploymentRouter(modelService, deployments, repository, deploymentTransport, auth));
	app.use(errorHandler);

	return app;
};

export const app = createApp();