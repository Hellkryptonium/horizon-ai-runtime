import type { ModelRepository } from "./models.repository.js";
import { modelCreationSchema, type ModelCreation } from "./models.validation.js";
import type { Model } from "./models.types.js";
import type { DeploymentRepository } from "../deployments/deployments.repository.js";

export class ModelNotFoundError extends Error {
  readonly code = "MODEL_NOT_FOUND";

  constructor() {
    super("Model not found.");
    this.name = "ModelNotFoundError";
  }
}

export class ModelInUseError extends Error {
  readonly code = "MODEL_IN_USE";

  constructor() {
    super("Stop or remove deployments using this model before deleting it.");
    this.name = "ModelInUseError";
  }
}

export class ModelService {
  constructor(
    private readonly repository: ModelRepository,
    private readonly deployments?: Pick<DeploymentRepository, "hasByModelId">,
  ) {}

  createModel(input: ModelCreation): Promise<Model> {
    return this.repository.createModel({
      ...input,
      runtimeModelId: input.runtimeModelId ?? null,
      minVramMb: input.minVramMb ?? null,
      contextLength: input.contextLength ?? null,
      downloadUrl: input.downloadUrl ?? null,
    });
  }

  listModels(): Promise<Model[]> {
    return this.repository.listModels();
  }

  async getModel(modelId: string): Promise<Model> {
    const model = await this.repository.getModel(modelId);

    if (!model) throw new ModelNotFoundError();
    return model;
  }

  validateModel(input: unknown): ModelCreation {
    return modelCreationSchema.parse(input);
  }

  async updateModel(modelId: string, input: ModelCreation) {
    if (!this.repository.updateModel) throw new Error("Model updates are unavailable.");
    const model = await this.repository.updateModel(modelId, {
      ...input,
      runtimeModelId: input.runtimeModelId ?? null,
      minVramMb: input.minVramMb ?? null,
      contextLength: input.contextLength ?? null,
      downloadUrl: input.downloadUrl ?? null,
    });
    if (!model) throw new ModelNotFoundError();
    return model;
  }

  async deleteModel(modelId: string) {
    if (!this.repository.deleteModel) throw new Error("Model deletion is unavailable.");
    await this.getModel(modelId);
    if (this.deployments?.hasByModelId && await this.deployments.hasByModelId(modelId)) throw new ModelInUseError();
    if (!await this.repository.deleteModel(modelId)) throw new ModelNotFoundError();
  }
}