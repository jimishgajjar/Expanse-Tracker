ALTER TABLE "recurring" ADD COLUMN "commitment_type" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring" ADD COLUMN "auto_post" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring" ADD COLUMN "total_amount" numeric(14, 2);