CREATE TABLE "transaction_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text,
	"author_id" text,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_comment_content" CHECK (("transaction_comments"."body" IS NULL AND "transaction_comments"."transaction_id" IS NULL) OR
    ("transaction_comments"."body" IS NOT NULL AND "transaction_comments"."transaction_id" IS NOT NULL AND char_length(trim("transaction_comments"."body")) BETWEEN 1 AND 1000))
);
--> statement-breakpoint
ALTER TABLE "transaction_comments" ADD CONSTRAINT "transaction_comments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_comments" ADD CONSTRAINT "transaction_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaction_comment_page" ON "transaction_comments" USING btree ("transaction_id","created_at","id");