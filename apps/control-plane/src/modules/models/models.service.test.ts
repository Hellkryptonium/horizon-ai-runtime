import { describe, expect, it } from "vitest";

import type { Model, NewModel } from "./models.types.js";
import { ModelNotFoundError, ModelService } from "./models.service.js";
import { modelCreationSchema } from "./models.validation.js";

const validModelInput = {
  name: "DeepSeek 7B",
  version: "1.0",
  format: "GGUF",
  runtime: "llama.cpp",
  runtimeModelId: null,
  sizeMb: 4500,
  minRamMb: 6000,
  minVramMb: 4000,
  requiresGpu: true,
  modelArchitecture: "llama",
  contextLength: 4096,
  downloadUrl: "https://example.com/model.gguf",
};

const createModel = (overrides: Partial<Model> = {}): Model => ({
  id: "00000000-0000-4000-8000-000000000001",
  ...validModelInput,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const createFakeRepository = (initialModels: Model[] = []) => {
  const models = [...initialModels];
  const repository = {
    async createModel(input: NewModel) {
      const model = createModel({
        ...input,
        id: "00000000-0000-4000-8000-000000000002",
        runtimeModelId: input.runtimeModelId ?? null,
        minVramMb: input.minVramMb ?? null,
        contextLength: input.contextLength ?? null,
        downloadUrl: input.downloadUrl ?? null,
      });
      models.push(model);
      return model;
    },
    async listModels() {
      return models;
    },
    async getModel(modelId: string) {
      return models.find((model) => model.id === modelId);
    },
  };

  return { models, repository };
};

describe("model validation", () => {
  it("accepts valid model creation metadata", () => {
    expect(modelCreationSchema.safeParse(validModelInput).success).toBe(true);
  });

  it("requires modelArchitecture and does not accept the old architecture field", () => {
    expect(
      modelCreationSchema.safeParse({
        ...validModelInput,
        modelArchitecture: undefined,
        architecture: "llama",
      }).success,
    ).toBe(false);

    expect(
      modelCreationSchema.safeParse({
        ...validModelInput,
        architecture: "x64",
      }).success,
    ).toBe(false);
  });

  it("rejects a missing name", () => {
    const { name: _name, ...input } = validModelInput;
    expect(modelCreationSchema.safeParse(input).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(modelCreationSchema.safeParse({ ...validModelInput, name: " " }).success).toBe(false);
  });

  it("rejects invalid size and RAM requirements", () => {
    expect(modelCreationSchema.safeParse({ ...validModelInput, sizeMb: 0 }).success).toBe(false);
    expect(modelCreationSchema.safeParse({ ...validModelInput, minRamMb: -1 }).success).toBe(false);
  });

  it("rejects invalid VRAM and context length", () => {
    expect(modelCreationSchema.safeParse({ ...validModelInput, minVramMb: -1 }).success).toBe(false);
    expect(modelCreationSchema.safeParse({ ...validModelInput, contextLength: 0 }).success).toBe(false);
  });

  it("rejects an invalid download URL", () => {
    expect(modelCreationSchema.safeParse({ ...validModelInput, downloadUrl: "not-a-url" }).success).toBe(false);
  });

  it("accepts a GPU-required model with VRAM metadata", () => {
    expect(
      modelCreationSchema.safeParse({ ...validModelInput, requiresGpu: true, minVramMb: 4096 }).success,
    ).toBe(true);
  });

  it("requires VRAM metadata for GPU-required models", () => {
    expect(modelCreationSchema.safeParse({ ...validModelInput, minVramMb: null }).success).toBe(false);
  });

  it("accepts CPU-only models with optional VRAM metadata", () => {
    expect(
      modelCreationSchema.safeParse({ ...validModelInput, requiresGpu: false, minVramMb: null }).success,
    ).toBe(true);
    expect(
      modelCreationSchema.safeParse({ ...validModelInput, requiresGpu: false, minVramMb: 1024 }).success,
    ).toBe(true);
  });
});

describe("model service", () => {
  it("creates a model through the repository", async () => {
    const { repository } = createFakeRepository();
    const service = new ModelService(repository);

    const model = await service.createModel(modelCreationSchema.parse(validModelInput));

    expect(model.name).toBe("DeepSeek 7B");
    expect(model.requiresGpu).toBe(true);
    expect(model.minVramMb).toBe(4000);
  });

  it("lists models through the repository", async () => {
    const existingModel = createModel();
    const { repository } = createFakeRepository([existingModel]);
    const service = new ModelService(repository);

    await expect(service.listModels()).resolves.toEqual([existingModel]);
  });

  it("gets an existing model", async () => {
    const existingModel = createModel();
    const { repository } = createFakeRepository([existingModel]);
    const service = new ModelService(repository);

    await expect(service.getModel(existingModel.id)).resolves.toEqual(existingModel);
  });

  it("returns MODEL_NOT_FOUND for a missing model", async () => {
    const service = new ModelService(createFakeRepository().repository);

    await expect(service.getModel("00000000-0000-4000-8000-000000000099")).rejects.toBeInstanceOf(
      ModelNotFoundError,
    );
  });
});
