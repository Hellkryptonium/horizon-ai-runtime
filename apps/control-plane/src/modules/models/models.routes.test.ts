import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import type { Model } from "./models.types.js";
import type { ModelRepository } from "./models.repository.js";

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

const existingModel: Model = {
  id: "00000000-0000-4000-8000-000000000001",
  ...validModelInput,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const createFakeRepository = (initialModels: Model[] = []): ModelRepository => {
  const models = [...initialModels];

  return {
    async createModel(input) {
      const model: Model = {
        id: "00000000-0000-4000-8000-000000000002",
        name: input.name,
        version: input.version,
        format: input.format,
        runtime: input.runtime,
        runtimeModelId: input.runtimeModelId ?? null,
        sizeMb: input.sizeMb,
        minRamMb: input.minRamMb,
        minVramMb: input.minVramMb ?? null,
        requiresGpu: input.requiresGpu ?? false,
        modelArchitecture: input.modelArchitecture,
        contextLength: input.contextLength ?? null,
        downloadUrl: input.downloadUrl ?? null,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      };
      models.push(model);
      return model;
    },
    async listModels() {
      return models;
    },
    async getModel(modelId) {
      return models.find((model) => model.id === modelId);
    },
  };
};

describe("model routes", () => {
  it("creates a model and returns 201", async () => {
    const response = await request(createApp(undefined, createFakeRepository()))
      .post("/api/models")
      .send(validModelInput);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.model).toMatchObject({
      id: "00000000-0000-4000-8000-000000000002",
      name: "DeepSeek 7B",
      modelArchitecture: "llama",
      requiresGpu: true,
    });
  });

  it("rejects an invalid model request with 400", async () => {
    const response = await request(createApp(undefined, createFakeRepository()))
      .post("/api/models")
      .send({ ...validModelInput, sizeMb: 0 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("lists models", async () => {
    const response = await request(createApp(undefined, createFakeRepository([existingModel]))).get(
      "/api/models",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, models: [expect.objectContaining({ id: existingModel.id })] });
  });

  it("gets an existing model", async () => {
    const response = await request(
      createApp(undefined, createFakeRepository([existingModel])),
    ).get(`/api/models/${existingModel.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, model: expect.objectContaining({ id: existingModel.id }) });
  });

  it("returns 404 for a missing model", async () => {
    const response = await request(createApp(undefined, createFakeRepository())).get(
      "/api/models/00000000-0000-4000-8000-000000000099",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: "MODEL_NOT_FOUND", message: "Model not found." },
    });
  });

  it("rejects a malformed model ID", async () => {
    const response = await request(createApp(undefined, createFakeRepository())).get(
      "/api/models/not-a-uuid",
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: "Invalid model ID" });
  });
});
