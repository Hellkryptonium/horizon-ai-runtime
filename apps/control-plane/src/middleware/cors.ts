import type { RequestHandler } from "express";

export const createCorsMiddleware = (origins: string[]): RequestHandler => (request, response, next) => {
  const origin = request.headers.origin;
  if (origin && origins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.setHeader("Vary", "Origin");
  }
  if (request.method === "OPTIONS") {
    response.sendStatus(origin && origins.includes(origin) ? 204 : 403);
    return;
  }
  next();
};
