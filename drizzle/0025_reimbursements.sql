CREATE TABLE "reimbursements" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"peer_id" text NOT NULL,
	"kind" "tx_kind" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"method" text NOT NULL,
	"split_ids" text[] NOT NULL,
	"request_hash" text NOT NULL,
	"transaction_id" text,
	"transfer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reopened_at" timestamp with time zone,
	CONSTRAINT "reimbursements_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "reimbursements_transfer_id_unique" UNIQUE("transfer_id"),
	CONSTRAINT "reimbursement_terms" CHECK ("reimbursements"."actor_id" <> "reimbursements"."peer_id" AND "reimbursements"."amount" > 0 AND cardinality("reimbursements"."split_ids") > 0
    AND "reimbursements"."method" IN ('link','record','outside') AND num_nonnulls("reimbursements"."transaction_id","reimbursements"."transfer_id") =
    CASE WHEN "reimbursements"."reopened_at" IS NOT NULL OR "reimbursements"."method"='outside' THEN 0 ELSE 1 END)
);
--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reimbursement_household_idx" ON "reimbursements" USING btree ("workspace_id","created_at");
--> statement-breakpoint
CREATE FUNCTION protect_reimbursement_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='transactions' THEN
    IF (OLD.type,OLD.amount,OLD.account_id,OLD.date,OLD.workspace_id) IS DISTINCT FROM
       (NEW.type,NEW.amount,NEW.account_id,NEW.date,NEW.workspace_id)
       AND EXISTS(SELECT 1 FROM reimbursements WHERE transaction_id=OLD.id) THEN
      RAISE EXCEPTION 'Reopen the reimbursement before changing its payment.';
    END IF;
  ELSE
    IF (OLD.from_account_id,OLD.to_account_id,OLD.amount,OLD.date,OLD.workspace_id) IS DISTINCT FROM
       (NEW.from_account_id,NEW.to_account_id,NEW.amount,NEW.date,NEW.workspace_id)
       AND EXISTS(SELECT 1 FROM reimbursements WHERE transfer_id=OLD.id) THEN
      RAISE EXCEPTION 'Reopen the reimbursement before changing its payment.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER reimbursement_transaction_guard BEFORE UPDATE OF type,amount,account_id,date,workspace_id ON transactions
FOR EACH ROW EXECUTE FUNCTION protect_reimbursement_payment();
--> statement-breakpoint
CREATE TRIGGER reimbursement_transfer_guard BEFORE UPDATE OF from_account_id,to_account_id,amount,date,workspace_id ON transfers
FOR EACH ROW EXECUTE FUNCTION protect_reimbursement_payment();
--> statement-breakpoint
CREATE FUNCTION prevent_reimbursement_refund() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM reimbursements WHERE transaction_id IN (NEW.credit_id,NEW.purchase_id)) THEN
    RAISE EXCEPTION 'Reopen the reimbursement before linking this payment to a refund.';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER reimbursement_refund_guard BEFORE INSERT OR UPDATE OF credit_id,purchase_id ON refund_links
FOR EACH ROW EXECUTE FUNCTION prevent_reimbursement_refund();
