import "../db/client.js";
import { isNull } from "drizzle-orm";

import { db } from "../db/index.js";
import { deployments } from "../db/schema.js";

if (process.env.NODE_ENV !== "development") {
  throw new Error("Refusing to clean orphan deployments: NODE_ENV must be exactly development.");
}

const orphaned = await db.select({
  id: deployments.id,
  name: deployments.name,
  modelId: deployments.modelId,
  workerId: deployments.workerId,
  status: deployments.status,
  createdAt: deployments.createdAt,
}).from(deployments).where(isNull(deployments.userId));

console.log("Orphaned deployments:");
console.table(orphaned);

if (!process.argv.includes("--delete")) {
  console.log("Dry run only. Re-run with --delete to remove these records.");
} else if (orphaned.length > 0) {
  await db.delete(deployments).where(isNull(deployments.userId));
  console.log(`Deleted ${orphaned.length} orphaned deployment(s).`);
}
