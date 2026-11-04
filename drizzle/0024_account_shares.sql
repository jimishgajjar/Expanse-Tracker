CREATE TABLE "account_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"ledger_id" text NOT NULL,
	"account_id" text NOT NULL,
	"household_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"revision" text NOT NULL,
	"report" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_share_recipient" UNIQUE("account_id","recipient_id"),
	CONSTRAINT "account_share_other_member" CHECK ("account_shares"."owner_id" <> "account_shares"."recipient_id")
);
--> statement-breakpoint
ALTER TABLE "account_shares" ADD CONSTRAINT "account_shares_ledger_id_personal_ledgers_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."personal_ledgers"("ledger_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_shares" ADD CONSTRAINT "account_shares_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_shares" ADD CONSTRAINT "account_shares_household_id_owner_id_workspace_members_workspace_id_user_id_fk" FOREIGN KEY ("household_id","owner_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_shares" ADD CONSTRAINT "account_shares_household_id_recipient_id_workspace_members_workspace_id_user_id_fk" FOREIGN KEY ("household_id","recipient_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_share_inbox" ON "account_shares" USING btree ("household_id","recipient_id");