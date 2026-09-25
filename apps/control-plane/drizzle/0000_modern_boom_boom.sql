CREATE TYPE "public"."worker_status" AS ENUM('ONLINE', 'OFFLINE', 'BUSY');--> statement-breakpoint
CREATE TABLE "workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "worker_status" DEFAULT 'OFFLINE' NOT NULL,
	"cpu_cores" integer NOT NULL,
	"total_ram_mb" integer NOT NULL,
	"available_ram_mb" integer NOT NULL,
	"gpu" text,
	"vram_mb" integer,
	"architecture" varchar(50),
	"operating_system" varchar(100) NOT NULL,
	"last_heartbeat" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
