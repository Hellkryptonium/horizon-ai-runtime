import { randomUUID } from "node:crypto";

import { inferenceRepository } from "./inference.repository.js";

const MAX_QUEUE_DEPTH = 100;
const MAX_ATTEMPTS = 2;

type QueueTask = {
	id: string;
	requestId: string;
	deploymentId: string;
	prompt: string;
	run: () => Promise<string>;
	resolve: (value: string) => void;
	reject: (error: Error) => void;
};

export class InferenceQueueFullError extends Error {
	readonly code = "INFERENCE_QUEUE_FULL";

	constructor() {
		super("The deployment inference queue is full.");
	}
}

export class InferenceQueue {
	private readonly queues = new Map<string, QueueTask[]>();
	private readonly running = new Set<string>();

	async enqueue(input: { requestId?: string; deploymentId: string; userId: string; prompt: string; run: () => Promise<string> }) {
		const queue = this.queues.get(input.deploymentId) ?? [];
		if (queue.length >= MAX_QUEUE_DEPTH) throw new InferenceQueueFullError();
		const requestId = input.requestId || randomUUID();
		const persisted = await inferenceRepository.create({ requestId, deploymentId: input.deploymentId, userId: input.userId, prompt: input.prompt, status: "QUEUED" });
		const result = new Promise<string>((resolve, reject) => queue.push({ id: persisted.id, requestId, deploymentId: input.deploymentId, prompt: input.prompt, run: input.run, resolve, reject }));
		this.queues.set(input.deploymentId, queue);
		void this.pump(input.deploymentId);
		return result;
	}

	private async pump(deploymentId: string) {
		if (this.running.has(deploymentId)) return;
		const queue = this.queues.get(deploymentId);
		const task = queue?.shift();
		if (!task) return;
		this.running.add(deploymentId);
		const startedAt = Date.now();
		try {
			await inferenceRepository.markRunning(task.id);
			let response = "";
			let lastError: Error | undefined;
			for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
				try { response = await task.run(); lastError = undefined; break; }
				catch (error) { lastError = error instanceof Error ? error : new Error("Inference failed."); }
			}
			if (lastError) throw lastError;
			await inferenceRepository.succeed(task.id, response);
			await inferenceRepository.recordUsage(task.id, Math.max(1, Math.ceil(task.prompt.length / 4)), Math.max(1, Math.ceil(response.length / 4)), Date.now() - startedAt);
			task.resolve(response);
		} catch (error) {
			const failure = error instanceof Error ? error : new Error("Inference failed.");
			await inferenceRepository.fail(task.id, failure.message, failure.message.toLowerCase().includes("timed out"));
			task.reject(failure);
		} finally {
			this.running.delete(deploymentId);
			void this.pump(deploymentId);
		}
	}
}