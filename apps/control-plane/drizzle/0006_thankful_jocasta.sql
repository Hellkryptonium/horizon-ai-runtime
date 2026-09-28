CREATE TABLE "worker_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worker_enrollments_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "workers" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "worker_enrollments" ADD CONSTRAINT "worker_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "worker_enrollments_user_id_idx" ON "worker_enrollments" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;