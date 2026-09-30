import type { RequestHandler } from "express";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const requests = new Map<string, { startedAt: number; count: number }>();

export const publicRateLimit: RequestHandler = (request, response, next) => {
	const key = request.authenticatedUser?.id || request.ip || "unknown-client";
	const now = Date.now();
	const current = requests.get(key);
	const entry = !current || now - current.startedAt >= WINDOW_MS ? { startedAt: now, count: 1 } : { ...current, count: current.count + 1 };
	requests.set(key, entry);
	response.setHeader("x-ratelimit-limit", MAX_REQUESTS);
	response.setHeader("x-ratelimit-remaining", Math.max(0, MAX_REQUESTS - entry.count));
	if (entry.count > MAX_REQUESTS) {
		response.setHeader("retry-after", Math.ceil((entry.startedAt + WINDOW_MS - now) / 1000));
		response.status(429).json({ success: false, error: { code: "RATE_LIMITED", message: "Too many inference requests." } });
		return;
	}
	next();
};