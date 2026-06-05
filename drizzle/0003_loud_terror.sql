CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "recurring" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "recurring" ADD COLUMN "max_occurrences" integer;--> statement-breakpoint
ALTER TABLE "recurring" ADD COLUMN "occurrence_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring" ADD COLUMN "alerts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring" ADD COLUMN "remind_days_before" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring" ADD COLUMN "last_reminded_for" date;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_user_idx" ON "push_subscriptions" USING btree ("user_id");