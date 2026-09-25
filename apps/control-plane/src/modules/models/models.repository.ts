import { desc, eq } from "drizzle-orm";

import { db } from "../../db/index.js";
import { models } from "../../db/schema.js";
import type { Model, NewModel } from "./models.types.js";

export interface ModelRepository {
  createModel(model: NewModel): Promise<Model>;
  listModels(): Promise<Model[]>;
  getModel(modelId: string): Promise<Model | undefined>;
}

export const modelRepository: ModelRepository = {
  async createModel(model) {
    const [createdModel] = await db.insert(models).values(model).returning();

    if (!createdModel) {
      throw new Error("Model insert did not return a model");
    }

    return createdModel;
  },

  async listModels() {
    return db.select().from(models).orderBy(desc(models.createdAt));
  },

  async getModel(modelId) {
    const [model] = await db.select().from(models).where(eq(models.id, modelId));
    return model;
  },
};