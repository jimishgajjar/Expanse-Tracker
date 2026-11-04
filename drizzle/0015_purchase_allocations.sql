CREATE TABLE "purchase_allocations" (
	"transaction_id" text NOT NULL,
	"category_id" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	CONSTRAINT "purchase_allocations_transaction_id_category_id_pk" PRIMARY KEY("transaction_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "purchase_allocations" ADD CONSTRAINT "purchase_allocations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_allocations" ADD CONSTRAINT "purchase_allocations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allocation_category_idx" ON "purchase_allocations" USING btree ("category_id");