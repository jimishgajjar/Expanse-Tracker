CREATE TABLE "annual_goal_plans" (
	"workspace_id" text NOT NULL,
	"goal_id" text NOT NULL,
	"due" date NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "annual_goal_plans_workspace_id_goal_id_pk" PRIMARY KEY("workspace_id","goal_id")
);
--> statement-breakpoint
CREATE TABLE "pay_period_plans" (
	"workspace_id" text NOT NULL,
	"account_id" text NOT NULL,
	"start_date" date NOT NULL,
	"next_date" date NOT NULL,
	"cadence" text NOT NULL,
	"expected" numeric(14, 2) NOT NULL,
	"spending_limit" numeric(14, 2) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pay_period_plans_workspace_id_account_id_start_date_pk" PRIMARY KEY("workspace_id","account_id","start_date")
);
--> statement-breakpoint
ALTER TABLE "annual_goal_plans" ADD CONSTRAINT "annual_goal_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_goal_plans" ADD CONSTRAINT "annual_goal_plans_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_period_plans" ADD CONSTRAINT "pay_period_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_period_plans" ADD CONSTRAINT "pay_period_plans_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;