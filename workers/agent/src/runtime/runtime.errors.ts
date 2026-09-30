export class UnsupportedRuntimeError extends Error {
  readonly code = "UNSUPPORTED_RUNTIME";

  constructor(runtime: string) {
    super(`Runtime '${runtime}' is not available in this worker runtime yet.`);
    this.name = "UnsupportedRuntimeError";
  }
}

export class InvalidRuntimeDeploymentError extends Error {
  readonly code = "INVALID_RUNTIME_DEPLOYMENT";

  constructor(message: string) {
    super(message);
    this.name = "InvalidRuntimeDeploymentError";
  }
}

export class DeploymentRuntimeNotFoundError extends Error {
  readonly code = "DEPLOYMENT_RUNTIME_NOT_FOUND";

  constructor(deploymentId: string) {
    super(`No runtime exists for deployment '${deploymentId}'.`);
    this.name = "DeploymentRuntimeNotFoundError";
  }
}

export class OllamaUnavailableError extends Error {
  readonly code = "OLLAMA_UNAVAILABLE";

  constructor(baseUrl: string) {
    super(`Ollama is not available at ${baseUrl}.`);
    this.name = "OllamaUnavailableError";
  }
}

export class ModelNotAvailableError extends Error {
  readonly code = "MODEL_NOT_AVAILABLE";

  constructor(modelId: string) {
    super(`Model '${modelId}' is not installed locally in Ollama.`);
    this.name = "ModelNotAvailableError";
  }
}

export class ModelStartFailedError extends Error {
  readonly code = "MODEL_START_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "ModelStartFailedError";
  }
}

export class ModelHealthCheckFailedError extends Error {
  readonly code = "MODEL_HEALTH_CHECK_FAILED";

  constructor(modelId: string) {
    super(`Ollama did not return a usable response for model '${modelId}'.`);
    this.name = "ModelHealthCheckFailedError";
  }
}

export class DockerUnavailableError extends Error {
  readonly code = "DOCKER_UNAVAILABLE";

  constructor() {
    super("Docker is not available on this worker.");
    this.name = "DockerUnavailableError";
  }
}

export class DockerImageNotAllowedError extends Error {
  readonly code = "DOCKER_IMAGE_NOT_ALLOWED";

  constructor(image: string) {
    super(`Docker image '${image}' is not approved for this worker.`);
    this.name = "DockerImageNotAllowedError";
  }
}

export class DockerHealthCheckFailedError extends Error {
  readonly code = "DOCKER_HEALTH_CHECK_FAILED";

  constructor() {
    super("Docker FastAPI service did not become healthy before the timeout.");
    this.name = "DockerHealthCheckFailedError";
  }
}
