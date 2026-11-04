CREATE TABLE "goal_opening_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"goal_id" text NOT NULL,
	"version" integer NOT NULL,
	"actor_id" text NOT NULL,
	"opening" numeric(14, 2) NOT NULL,
	"reserved" numeric(16, 2) NOT NULL,
	"outside" numeric(14, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "goal_opening_review_version" UNIQUE("workspace_id","goal_id","version"),
	CONSTRAINT "goal_opening_review_amount" CHECK ("goal_opening_reviews"."outside">=0 AND "goal_opening_reviews"."outside"<="goal_opening_reviews"."opening" AND "goal_opening_reviews"."version">0)
);
--> statement-breakpoint
ALTER TABLE "goal_opening_reviews" ADD CONSTRAINT "goal_opening_reviews_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_opening_reviews" ADD CONSTRAINT "goal_opening_reviews_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE restrict ON UPDATE no action;