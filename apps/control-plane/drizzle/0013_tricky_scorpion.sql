CREATE TYPE "public"."connection_request_status" AS ENUM('REQUESTED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."deployment_request_status" AS ENUM('REQUESTED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'DEPLOYING', 'RUNNING', 'FAILED', 'STOPPED');--> statement-breakpoint
CREATE TABLE "connection_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"status" "connection_request_status" DEFAULT 'REQUESTED' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"connection_request_id" uuid NOT NULL,
	"deployment_id" uuid,
	"name" varchar(255),
	"status" "deployment_request_status" DEFAULT 'REQUESTED' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_requests" ADD CONSTRAINT "connection_requests_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_requests" ADD CONSTRAINT "deployment_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_requests" ADD CONSTRAINT "deployment_requests_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_requests" ADD CONSTRAINT "deployment_requests_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_requests" ADD CONSTRAINT "deployment_requests_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_requests" ADD CONSTRAINT "deployment_requests_connection_request_id_connection_requests_id_fk" FOREIGN KEY ("connection_request_id") REFERENCES "public"."connection_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_requests" ADD CONSTRAINT "deployment_requests_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connection_requests_requester_idx" ON "connection_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "connection_requests_provider_idx" ON "connection_requests" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "connection_requests_worker_idx" ON "connection_requests" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "deployment_requests_requester_idx" ON "deployment_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "deployment_requests_provider_idx" ON "deployment_requests" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "deployment_requests_status_idx" ON "deployment_requests" USING btree ("status");