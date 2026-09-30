ALTER TYPE "public"."deployment_status" ADD VALUE 'STOPPING' BEFORE 'FAILED';--> statement-breakpoint
ALTER TYPE "public"."deployment_status" ADD VALUE 'STOPPED' BEFORE 'FAILED';--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "name" varchar(255);