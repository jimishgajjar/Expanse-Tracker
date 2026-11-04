CREATE TABLE "comment_mentions" (
	"comment_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "comment_mentions_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id"),
	CONSTRAINT "mention_household_only" CHECK ("comment_mentions"."workspace_id" NOT LIKE 'personal:%')
);
--> statement-breakpoint
CREATE TABLE "invitation_preferences" (
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	CONSTRAINT "invitation_preferences_user_id_channel_pk" PRIMARY KEY("user_id","channel"),
	CONSTRAINT "invitation_channel" CHECK ("invitation_preferences"."channel" IN ('email','push'))
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_topic";--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_comment_id_transaction_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."transaction_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_workspace_id_user_id_workspace_members_workspace_id_user_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_preferences" ADD CONSTRAINT "invitation_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_topic" CHECK ("notification_preferences"."topic" IN ('upcoming','posted','budget','monthly','mention'));