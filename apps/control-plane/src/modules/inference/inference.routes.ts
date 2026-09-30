import { Router } from "express";

import { requireAuth } from "../../middleware/auth.js";
import { AuthService } from "../auth/auth.service.js";
import type { DeploymentRepository } from "../deployments/deployments.repository.js";
import { replicaRepository } from "../deployments/replica.repository.js";
import { inferenceRepository } from "./inference.repository.js";

export const createInferenceRouter = (
	auth: AuthService,
	deployments: Pick<DeploymentRepository, "getDeployment">,
) => {
	const router = Router();
	router.use(requireAuth(auth));

	router.get("/requests", async (request, response, next) => {
		try {
			const deploymentId = typeof request.query.deploymentId === "string" ? request.query.deploymentId : undefined;
			if (deploymentId) {
				const deployment = await deployments.getDeployment(deploymentId, request.authenticatedUser!.id);
				if (!deployment) { response.status(404).json({ success: false, error: "Deployment not found." }); return; }
			}
			response.json({ success: true, requests: await inferenceRepository.listForUser(request.authenticatedUser!.id, deploymentId) });
		} catch (error) { next(error); }
	});

	router.get("/usage", async (request, response, next) => {
		try { response.json({ success: true, usage: await inferenceRepository.listUsageForUser(request.authenticatedUser!.id) }); }
		catch (error) { next(error); }
	});

	router.get("/deployments/:deploymentId/replicas", async (request, response, next) => {
		try {
			const deployment = await deployments.getDeployment(request.params.deploymentId, request.authenticatedUser!.id);
			if (!deployment) { response.status(404).json({ success: false, error: "Deployment not found." }); return; }
			response.json({ success: true, replicas: await replicaRepository.listForDeployment(deployment.id) });
		} catch (error) { next(error); }
	});

	return router;
};