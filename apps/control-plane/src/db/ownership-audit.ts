import { count, isNull } from "drizzle-orm";

import { db } from "./index.js";
import { deployments, workers } from "./schema.js";

export const auditLegacyOwnership = async () => {
  const [deploymentRows, workerRows] = await Promise.all([
    db.select({ count: count() }).from(deployments).where(isNull(deployments.userId)),
    db.select({ count: count() }).from(workers).where(isNull(workers.userId)),
  ]);
  return {
    unownedDeployments: Number(deploymentRows[0]?.count ?? 0),
    unownedWorkers: Number(workerRows[0]?.count ?? 0),
  };
};
