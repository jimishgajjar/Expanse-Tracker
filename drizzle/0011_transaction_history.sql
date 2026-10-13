CREATE TABLE "backup_reports" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"verified_at" timestamp NOT NULL,
	"row_count" integer NOT NULL,
	"destination" text DEFAULT 'Encrypted local files' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_history" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "backup_reports" ADD CONSTRAINT "backup_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "history_ws_tx_idx" ON "transaction_history" USING btree ("workspace_id","transaction_id","created_at");