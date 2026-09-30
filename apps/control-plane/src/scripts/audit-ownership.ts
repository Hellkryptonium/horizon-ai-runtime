import "../db/client.js";
import { auditLegacyOwnership } from "../db/ownership-audit.js";

const audit = await auditLegacyOwnership();
console.log(JSON.stringify(audit, null, 2));
if (audit.unownedDeployments > 0 || audit.unownedWorkers > 0) process.exitCode = 2;
