CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"version" varchar(100) NOT NULL,
	"format" varchar(50) NOT NULL,
	"runtime" varchar(100) NOT NULL,
	"size_mb" integer NOT NULL,
	"min_ram_mb" integer NOT NULL,
	"min_vram_mb" integer,
	"requires_gpu" boolean DEFAULT false NOT NULL,
	"architecture" varchar(100) NOT NULL,
	"context_length" integer,
	"download_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
