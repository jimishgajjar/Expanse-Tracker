CREATE TABLE "merchant_rule_versions" (
	"workspace_id" text NOT NULL,
	"account_id" text NOT NULL,
	"kind" "tx_kind" NOT NULL,
	"id" text NOT NULL,
	"version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_rule_versions_workspace_id_account_id_kind_id_version_pk" PRIMARY KEY("workspace_id","account_id","kind","id","version")
);
--> statement-breakpoint
ALTER TABLE "merchant_rule_versions" ADD CONSTRAINT "merchant_rule_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;