CREATE TABLE "budget_moves" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"month" date NOT NULL,
	"from_category" text NOT NULL,
	"to_category" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "budget_move_valid" CHECK ("budget_moves"."amount">0 AND "budget_moves"."from_category"<>"budget_moves"."to_category" AND extract(day from "budget_moves"."month")=1)
);
--> statement-breakpoint
ALTER TABLE "budget_moves" ADD CONSTRAINT "budget_moves_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_moves" ADD CONSTRAINT "budget_moves_from_category_categories_id_fk" FOREIGN KEY ("from_category") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_moves" ADD CONSTRAINT "budget_moves_to_category_categories_id_fk" FOREIGN KEY ("to_category") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_move_month_idx" ON "budget_moves" USING btree ("workspace_id","month");