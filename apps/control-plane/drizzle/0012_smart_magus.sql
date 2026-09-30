CREATE TYPE "public"."inference_request_status" AS ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT');--> statement-breakpoint
CREATE TABLE "deployment_replicas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"active_requests" integer DEFAULT 0 NOT NULL,
	"max_concurrency" integer DEFAULT 1 NOT NULL,
	"last_health_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inference_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar(100) NOT NULL,
	"deployment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"status" "inference_request_status" DEFAULT 'QUEUED' NOT NULL,
	"response" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "inference_requests_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "inference_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"latency_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "active_requests" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "max_concurrency" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_replicas" ADD CONSTRAINT "deployment_replicas_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_replicas" ADD CONSTRAINT "deployment_replicas_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inference_requests" ADD CONSTRAINT "inference_requests_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inference_requests" ADD CONSTRAINT "inference_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inference_usage" ADD CONSTRAINT "inference_usage_request_id_inference_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."inference_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deployment_replicas_deployment_idx" ON "deployment_replicas" USING btree ("deployment_id");--> statement-breakpoint
CREATE INDEX "deployment_replicas_worker_idx" ON "deployment_replicas" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "inference_requests_deployment_status_idx" ON "inference_requests" USING btree ("deployment_id","status");--> statement-breakpoint
CREATE INDEX "inference_requests_user_idx" ON "inference_requests" USING btree ("user_id");