import "dotenv/config";
import { inArray } from "drizzle-orm";

import { db } from "../db/index.js";
import { deployments, models, workers } from "../db/schema.js";

const TEST_WORKER_IDS = [
  "470b8afc-f6a1-41d1-b435-f96e09a34f00",
  "25dd30bf-4bbc-49a0-986b-64e696e9dfb7",
  "29557366-f057-4ef5-8478-ecc83f1efb4b",
  "0313f037-3ea6-44ed-bb6b-f337272886d8",
  "aad7440d-4c98-4a80-873f-49d3d4252bef",
  "7e11eeb7-97bb-4380-833f-7f57b268efba",
];

const TEST_DEPLOYMENT_IDS = [
  "3fcb8518-dd3c-4e62-96f9-d57033b5a915",
  "91e30701-2747-4d9b-be9a-278bbc186660",
  "bd17bb22-0a44-46b1-82e5-7486ae6c9243",
  "bb9c62cb-e11e-40bc-b8b9-b40e2c0d4ef7",
  "c5c53b31-93d5-4228-b761-8fbced49d119",
  "d909c38b-ac0f-4a32-9c9f-f1906c5cc987",
];

const DUPLICATE_MODEL_IDS = [
  "d1a8131e-dd51-465a-bbed-e43b3562761e",
  "47582829-bf46-4cce-9951-e99846e438ce",
  "6083bef4-5ce1-4738-abb8-115c00a34b50",
  "01670b6c-aeb3-47b4-8f63-c8c96b57d558",
];

const main = async () => {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Refusing to reset test runtime data: NODE_ENV must be exactly development.");
  }

  const matchingDeployments = await db
    .select({ id: deployments.id, modelId: deployments.modelId, workerId: deployments.workerId })
    .from(deployments)
    .where(inArray(deployments.id, TEST_DEPLOYMENT_IDS));
  const matchingWorkers = await db
    .select({ id: workers.id, name: workers.name, status: workers.status })
    .from(workers)
    .where(inArray(workers.id, TEST_WORKER_IDS));
  const matchingModels = await db
    .select({ id: models.id, name: models.name, runtime: models.runtime })
    .from(models)
    .where(inArray(models.id, DUPLICATE_MODEL_IDS));

  console.log(`Deployments to delete: ${matchingDeployments.length}`);
  console.log(`Workers to delete: ${matchingWorkers.length}`);
  console.log(`Duplicate models to delete: ${matchingModels.length}`);

  if (matchingDeployments.length > 0) {
    await db.delete(deployments).where(inArray(deployments.id, TEST_DEPLOYMENT_IDS));
  }
  if (matchingWorkers.length > 0) {
    await db.delete(workers).where(inArray(workers.id, TEST_WORKER_IDS));
  }
  if (matchingModels.length > 0) {
    await db.delete(models).where(inArray(models.id, DUPLICATE_MODEL_IDS));
  }

  const remainingWorkers = await db.select({ id: workers.id, name: workers.name, status: workers.status }).from(workers);
  const remainingModels = await db.select({ id: models.id, name: models.name, runtime: models.runtime }).from(models);
  const remainingDeployments = await db.select({ id: deployments.id, modelId: deployments.modelId, workerId: deployments.workerId }).from(deployments);

  console.log("Remaining workers:", remainingWorkers);
  console.log("Remaining models:", remainingModels);
  console.log("Remaining deployments:", remainingDeployments);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Test runtime reset failed.");
  process.exitCode = 1;
});
