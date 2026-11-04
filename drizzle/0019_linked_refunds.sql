CREATE TABLE "refund_links" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"credit_id" text NOT NULL,
	"purchase_id" text NOT NULL,
	"portions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refund_links_credit_id_unique" UNIQUE("credit_id")
);
--> statement-breakpoint
ALTER TABLE "refund_links" ADD CONSTRAINT "refund_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_links" ADD CONSTRAINT "refund_links_credit_id_transactions_id_fk" FOREIGN KEY ("credit_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_links" ADD CONSTRAINT "refund_links_purchase_id_transactions_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refund_purchase_idx" ON "refund_links" USING btree ("workspace_id","purchase_id");
--> statement-breakpoint
CREATE FUNCTION protect_refund_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (OLD.workspace_id,OLD.account_id,OLD.type,OLD.date,OLD.amount,OLD.category_id)
    IS DISTINCT FROM (NEW.workspace_id,NEW.account_id,NEW.type,NEW.date,NEW.amount,NEW.category_id)
    AND EXISTS (SELECT 1 FROM refund_links WHERE credit_id=OLD.id OR purchase_id=OLD.id) THEN
   RAISE EXCEPTION 'Unlink the refund before editing the account, date, type, category or amount.';
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER refund_transaction_guard BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION protect_refund_transaction();
--> statement-breakpoint
CREATE FUNCTION protect_refund_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD IS NOT DISTINCT FROM NEW THEN RETURN NULL; END IF;
 IF EXISTS (SELECT 1 FROM refund_links WHERE purchase_id=CASE WHEN TG_OP='INSERT' THEN NEW.transaction_id ELSE OLD.transaction_id END
   OR purchase_id=CASE WHEN TG_OP='DELETE' THEN OLD.transaction_id ELSE NEW.transaction_id END) THEN
   RAISE EXCEPTION 'Unlink the refund before editing the purchase categories.';
 END IF;
 RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER refund_allocation_guard AFTER INSERT OR UPDATE OR DELETE ON purchase_allocations FOR EACH ROW EXECUTE FUNCTION protect_refund_allocation();
