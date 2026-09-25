import {
	boolean,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const workerStatus = pgEnum("worker_status", ["ONLINE", "OFFLINE", "BUSY"]);

export const workers = pgTable("workers", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	status: workerStatus("status").default("OFFLINE").notNull(),
	cpuCores: integer("cpu_cores").notNull(),
	totalRamMb: integer("total_ram_mb").notNull(),
	availableRamMb: integer("available_ram_mb").notNull(),
	gpu: text("gpu"),
	vramMb: integer("vram_mb"),
	architecture: varchar("architecture", { length: 50 }),
	operatingSystem: varchar("operating_system", { length: 100 }).notNull(),
	lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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
	"FAILED",
]);

export const deployments = pgTable("deployments", {
	id: uuid("id").defaultRandom().primaryKey(),
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