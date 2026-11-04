CREATE TABLE "forecast_scenarios" (
	"workspace_id" text NOT NULL,
	"account_id" text NOT NULL,
	"scenario" text NOT NULL,
	"daily" numeric(14, 2) NOT NULL,
	"buffer" numeric(14, 2) NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "forecast_scenarios_workspace_id_account_id_scenario_pk" PRIMARY KEY("workspace_id","account_id","scenario"),
	CONSTRAINT "forecast_scenario_values" CHECK ("forecast_scenarios"."scenario" IN ('base','conservative') AND "forecast_scenarios"."daily">=0 AND "forecast_scenarios"."buffer">=0 AND "forecast_scenarios"."version">0)
);
--> statement-breakpoint
ALTER TABLE "forecast_scenarios" ADD CONSTRAINT "forecast_scenarios_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_scenarios" ADD CONSTRAINT "forecast_scenarios_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;