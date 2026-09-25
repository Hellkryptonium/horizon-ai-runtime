import type { ModelRepository } from "./models.repository.js";
import { modelCreationSchema, type ModelCreation } from "./models.validation.js";
import type { Model } from "./models.types.js";

export class ModelNotFoundError extends Error {
  readonly code = "MODEL_NOT_FOUND";

  constructor() {
    super("Model not found.");
    this.name = "ModelNotFoundError";
  }
}

export class ModelService {
  constructor(private readonly repository: ModelRepository) {}

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
}