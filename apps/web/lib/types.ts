export type WorkerStatus = "ONLINE" | "OFFLINE" | "BUSY";
export type DeploymentStatus = "PENDING" | "DEPLOYING" | "RUNNING" | "FAILED";
export type User = { id: string; name: string; email: string };
export type ApiToken = { id: string; name: string; preview: string; createdAt: string };
