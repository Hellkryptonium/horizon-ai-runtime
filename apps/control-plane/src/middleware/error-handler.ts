import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (
    error instanceof SyntaxError &&
    "type" in error &&
    error.type === "entity.parse.failed"
  ) {
    response.status(400).json({
      success: false,
      error: "Invalid JSON request body",
    });
    return;
  }

  console.error(error);

  response.status(500).json({
    status: "error",
    message: "Internal server error",
  });
};