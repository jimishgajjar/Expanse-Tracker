CREATE TABLE "notification_preferences" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"topic" text NOT NULL,
	"channel" text NOT NULL,
	CONSTRAINT "notification_preferences_workspace_id_user_id_topic_channel_pk" PRIMARY KEY("workspace_id","user_id","topic","channel"),
	CONSTRAINT "notification_household_only" CHECK ("notification_preferences"."workspace_id" NOT LIKE 'personal:%'),
	CONSTRAINT "notification_topic" CHECK ("notification_preferences"."topic" IN ('upcoming','posted','budget','monthly')),
	CONSTRAINT "notification_channel" CHECK ("notification_preferences"."channel" IN ('email','push'))
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_user_id_workspace_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;