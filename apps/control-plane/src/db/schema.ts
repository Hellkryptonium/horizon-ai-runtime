import {
	boolean,
	integer,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	email: varchar("email", { length: 320 }).notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	tokenHash: text("token_hash").notNull().unique(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
	sessionsUserIdIndex: index("sessions_user_id_idx").on(table.userId),
}));

export const workerStatus = pgEnum("worker_status", ["ONLINE", "OFFLINE", "BUSY"]);

export const workers = pgTable("workers", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
	credentialHash: text("credential_hash").unique(),
	name: varchar("name", { length: 255 }).notNull(),
	status: workerStatus("status").default("OFFLINE").notNull(),
	cpuCores: integer("cpu_cores").notNull(),
	totalRamMb: integer("total_ram_mb").notNull(),
	availableRamMb: integer("available_ram_mb").notNull(),
	activeRequests: integer("active_requests").default(0).notNull(),
	maxConcurrency: integer("max_concurrency").default(1).notNull(),
	gpu: text("gpu"),
	vramMb: integer("vram_mb"),
	architecture: varchar("architecture", { length: 50 }),
	operatingSystem: varchar("operating_system", { length: 100 }).notNull(),
	lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
	revokedAt: timestamp("revoked_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workerEnrollments = pgTable("worker_enrollments", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	tokenHash: text("token_hash").notNull().unique(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
	workerEnrollmentsUserIdIndex: index("worker_enrollments_user_id_idx").on(table.userId),
}));

export const models = pgTable("models", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	version: varchar("version", { length: 100 }).notNull(),
	format: varchar("format", { length: 50 }).notNull(),
	runtime: varchar("runtime", { length: 100 }).notNull(),
	runtimeModelId: varchar("runtime_model_id", { length: 255 }),
	sizeMb: integer("size_mb").notNull(),
	minRamMb: integer("min_ram_mb").notNull(),
	minVramMb: integer("min_vram_mb"),
	requiresGpu: boolean("requires_gpu").default(false).notNull(),
	modelArchitecture: varchar("model_architecture", { length: 100 }).notNull(),
	contextLength: integer("context_length"),
	downloadUrl: text("download_url"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const deploymentStatus = pgEnum("deployment_status", [
	"PENDING",
	"SCHEDULED",
	"DEPLOYING",
	"RUNNING",
	"STOPPING",
	"STOPPED",
	"FAILED",
]);

export const deployments = pgTable("deployments", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
	name: varchar("name", { length: 255 }),
	modelId: uuid("model_id")
		.notNull()
		.references(() => models.id),
	workerId: uuid("worker_id")
		.notNull()
		.references(() => workers.id),
	status: deploymentStatus("status").default("PENDING").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inferenceRequestStatus = pgEnum("inference_request_status", ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "TIMED_OUT"]);

export const deploymentReplicas = pgTable("deployment_replicas", {
	id: uuid("id").defaultRandom().primaryKey(),
	deploymentId: uuid("deployment_id").notNull().references(() => deployments.id, { onDelete: "cascade" }),
	workerId: uuid("worker_id").notNull().references(() => workers.id, { onDelete: "cascade" }),
	activeRequests: integer("active_requests").default(0).notNull(),
	maxConcurrency: integer("max_concurrency").default(1).notNull(),
	lastHealthAt: timestamp("last_health_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
	deploymentReplicasDeploymentIndex: index("deployment_replicas_deployment_idx").on(table.deploymentId),
	deploymentReplicasWorkerIndex: index("deployment_replicas_worker_idx").on(table.workerId),
}));

export const inferenceRequests = pgTable("inference_requests", {
	id: uuid("id").defaultRandom().primaryKey(),
	requestId: varchar("request_id", { length: 100 }).notNull().unique(),
	deploymentId: uuid("deployment_id").notNull().references(() => deployments.id, { onDelete: "cascade" }),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	prompt: text("prompt").notNull(),
	status: inferenceRequestStatus("status").default("QUEUED").notNull(),
	response: text("response"),
	error: text("error"),
	attempts: integer("attempts").default(0).notNull(),
	queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),
	startedAt: timestamp("started_at", { withTimezone: true }),
	completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
	inferenceRequestsDeploymentStatusIndex: index("inference_requests_deployment_status_idx").on(table.deploymentId, table.status),
	inferenceRequestsUserIndex: index("inference_requests_user_idx").on(table.userId),
}));

export const inferenceUsage = pgTable("inference_usage", {
	id: uuid("id").defaultRandom().primaryKey(),
	requestId: uuid("request_id").notNull().references(() => inferenceRequests.id, { onDelete: "cascade" }),
	promptTokens: integer("prompt_tokens").notNull(),
	completionTokens: integer("completion_tokens").notNull(),
	latencyMs: integer("latency_ms").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	name: varchar("name", { length: 100 }).notNull(),
	tokenHash: text("token_hash").notNull().unique(),
	tokenPrefix: varchar("token_prefix", { length: 32 }).notNull(),
	scopes: text("scopes").notNull().default("inference:write"),
	expiresAt: timestamp("expires_at", { withTimezone: true }),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	revokedAt: timestamp("revoked_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
	apiKeysUserIdIndex: index("api_keys_user_id_idx").on(table.userId),
}));