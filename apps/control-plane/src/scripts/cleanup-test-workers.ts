import "dotenv/config";
import { inArray } from "drizzle-orm";

import { db } from "../db/index.js";
import { workers } from "../db/schema.js";

const TEST_WORKER_NAMES = [
  "api-verification-worker-2",
  "mac-01",
  "mvp-agent-verification",
  "Harish",
  "heartbeat-e2e-worker",
];

const main = async () => {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Refusing to clean workers: NODE_ENV must be exactly development.");
  }

  const matchingWorkers = await db
    .select({ id: workers.id, name: workers.name, status: workers.status })
    .from(workers)
    .where(inArray(workers.name, TEST_WORKER_NAMES));

  console.log("Found test workers:");
  if (matchingWorkers.length === 0) {
    console.log("- none");
  } else {
    for (const worker of matchingWorkers) {
      console.log(`- id: ${worker.id}`);
      console.log(`  name: ${worker.name}`);
      console.log(`  status: ${worker.status}`);
    }
  }

  if (matchingWorkers.length > 0) {
    await db.delete(workers).where(inArray(workers.name, TEST_WORKER_NAMES));
  }

  const remainingWorkers = await db
    .select({ id: workers.id, name: workers.name, status: workers.status })
    .from(workers);

  console.log("Remaining workers:");
  if (remainingWorkers.length === 0) {
    console.log("- none");
  } else {
    for (const worker of remainingWorkers) {
      console.log(`- id: ${worker.id}`);
      console.log(`  name: ${worker.name}`);
      console.log(`  status: ${worker.status}`);
    }
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Worker cleanup failed.");
  process.exitCode = 1;
});
