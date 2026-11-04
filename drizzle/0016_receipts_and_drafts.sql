CREATE TABLE "capture_drafts" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "capture_drafts_workspace_id_user_id_id_pk" PRIMARY KEY("workspace_id","user_id","id")
);
--> statement-breakpoint
CREATE TABLE "receipt_images" (
	"transaction_id" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"jpeg" text NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "receipt_images_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "capture_drafts" ADD CONSTRAINT "capture_drafts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_drafts" ADD CONSTRAINT "capture_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_images" ADD CONSTRAINT "receipt_images_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;