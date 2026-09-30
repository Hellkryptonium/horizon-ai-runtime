import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestContext: RequestHandler = (request, response, next) => {
	const requestId = request.header("x-request-id") || randomUUID();
	response.setHeader("x-request-id", requestId);
	request.requestId = requestId;
	next();
};