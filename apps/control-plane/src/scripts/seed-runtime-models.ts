import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { models } from "../db/schema.js";

const dockerModel = {
  name: "Horizon Sentiment",
  version: "0.1",
  format: "DOCKER",
  runtime: "docker-fastapi",
  runtimeModelId: "horizon/ml-sentiment:0.1",
  sizeMb: 1000,
  minRamMb: 1024,
  minVramMb: null,
  requiresGpu: false,
  modelArchitecture: "distilbert",
  contextLength: null,
  downloadUrl: null,
};

const existing = await db.select({ id: models.id }).from(models).where(eq(models.runtimeModelId, dockerModel.runtimeModelId)).limit(1);
if (existing.length > 0) {
  console.log(`Docker model already registered: ${dockerModel.runtimeModelId}`);
} else {
  const [created] = await db.insert(models).values(dockerModel).returning({ id: models.id });
  console.log(`Registered Docker model ${dockerModel.runtimeModelId} (${created.id})`);
}
