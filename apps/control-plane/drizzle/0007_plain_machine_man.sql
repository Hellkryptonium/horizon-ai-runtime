ALTER TABLE "workers" ADD COLUMN "credential_hash" text;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_credential_hash_unique" UNIQUE("credential_hash");