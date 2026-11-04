CREATE TABLE finance_books (
  workspace_id text PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE account_denominations (
  workspace_id text NOT NULL REFERENCES finance_books ON DELETE CASCADE, account_id text NOT NULL,
  currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), PRIMARY KEY(workspace_id,account_id),
  FOREIGN KEY(workspace_id,account_id) REFERENCES finance_accounts ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE valuation_quotes (
  workspace_id text NOT NULL REFERENCES finance_books ON DELETE CASCADE,
  currency text NOT NULL, as_of timestamptz NOT NULL, rate numeric NOT NULL CHECK(rate>0),
  source text NOT NULL, PRIMARY KEY(workspace_id,currency,as_of)
);
--> statement-breakpoint
CREATE TABLE finance_operations (
  id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES finance_books ON DELETE CASCADE,
  actor text NOT NULL, fingerprint text NOT NULL
);
--> statement-breakpoint
CREATE TABLE finance_bookings (
  id text PRIMARY KEY, operation_id text NOT NULL REFERENCES finance_operations ON DELETE RESTRICT,
  workspace_id text NOT NULL REFERENCES finance_books ON DELETE CASCADE,
  transaction_id text UNIQUE REFERENCES transactions ON DELETE RESTRICT,
  transfer_id text UNIQUE REFERENCES transfers ON DELETE RESTRICT,
  refund_of text REFERENCES transactions ON DELETE RESTRICT,
  kind text NOT NULL CHECK(kind IN ('income','purchase','refund','interest','fee','transfer','payment')),
  original_amount numeric NOT NULL CHECK(original_amount>0), original_currency text NOT NULL,
  original_rate numeric NOT NULL CHECK(original_rate>0),
  account_amount numeric NOT NULL CHECK(account_amount>0), account_currency text NOT NULL,
  reporting_amount numeric, reporting_currency text NOT NULL, booked_rate numeric CHECK(booked_rate>0),
  source text NOT NULL, as_of timestamptz NOT NULL,
  received numeric CHECK(received>0), destination_currency text, exchange_rate numeric CHECK(exchange_rate>0), residual numeric,
  principal_paid numeric, interest_paid numeric, fees_paid numeric,
  CHECK (kind<>'payment' OR (principal_paid>=0 AND interest_paid>=0 AND fees_paid>=0 AND principal_paid+interest_paid+fees_paid=received)),
  CHECK ((reporting_amount IS NULL)=(booked_rate IS NULL)),
  CHECK ((kind='refund')=(refund_of IS NOT NULL)),
  CHECK (CASE WHEN kind IN ('transfer','payment') THEN transfer_id IS NOT NULL AND transaction_id IS NULL
    AND received IS NOT NULL AND destination_currency IS NOT NULL AND exchange_rate IS NOT NULL AND residual IS NOT NULL
    ELSE transaction_id IS NOT NULL AND transfer_id IS NULL AND received IS NULL AND destination_currency IS NULL AND exchange_rate IS NULL AND residual IS NULL END)
);
--> statement-breakpoint
CREATE INDEX finance_bookings_workspace ON finance_bookings(workspace_id);
--> statement-breakpoint
CREATE INDEX finance_refunds_purchase ON finance_bookings(workspace_id,refund_of) WHERE refund_of IS NOT NULL;
--> statement-breakpoint
CREATE FUNCTION guard_booked_money() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='transactions' THEN
    IF (NEW.workspace_id,NEW.account_id,NEW.type,NEW.amount,NEW.date) IS DISTINCT FROM
       (OLD.workspace_id,OLD.account_id,OLD.type,OLD.amount,OLD.date)
       AND EXISTS(SELECT 1 FROM finance_bookings WHERE transaction_id=OLD.id OR refund_of=OLD.id)
    THEN RAISE EXCEPTION 'Booked amounts and dates are immutable'; END IF;
  ELSE
    IF (NEW.workspace_id,NEW.from_account_id,NEW.to_account_id,NEW.amount,NEW.date) IS DISTINCT FROM
       (OLD.workspace_id,OLD.from_account_id,OLD.to_account_id,OLD.amount,OLD.date)
       AND EXISTS(SELECT 1 FROM finance_bookings WHERE transfer_id=OLD.id)
    THEN RAISE EXCEPTION 'Booked transfer legs are immutable'; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER finance_guard_transaction BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION guard_booked_money();
--> statement-breakpoint
CREATE TRIGGER finance_guard_transfer BEFORE UPDATE ON transfers FOR EACH ROW EXECUTE FUNCTION guard_booked_money();
--> statement-breakpoint
-- Older refund screens may still operate on the same purchase. Lock the source
-- purchase in both paths and count both kinds of linked credit.
CREATE FUNCTION guard_finance_refund_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE capacity numeric; used numeric; credit numeric;
BEGIN
  IF EXISTS(SELECT 1 FROM finance_bookings WHERE transaction_id=NEW.credit_id) THEN
    RAISE EXCEPTION 'This credit already has a financial booking';
  END IF;
  SELECT amount INTO capacity FROM transactions WHERE id=NEW.purchase_id AND workspace_id=NEW.workspace_id FOR UPDATE;
  SELECT amount INTO credit FROM transactions WHERE id=NEW.credit_id AND workspace_id=NEW.workspace_id;
  SELECT coalesce(sum(account_amount),0) INTO used FROM finance_bookings WHERE refund_of=NEW.purchase_id AND workspace_id=NEW.workspace_id;
  IF used>0 AND used+credit+coalesce((SELECT sum(t.amount) FROM refund_links r JOIN transactions t ON t.id=r.credit_id
      WHERE r.purchase_id=NEW.purchase_id AND r.workspace_id=NEW.workspace_id
        AND NOT EXISTS(SELECT 1 FROM finance_bookings b WHERE b.transaction_id=r.credit_id)),0)>capacity THEN
    RAISE EXCEPTION 'Refund exceeds remaining purchase amount';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER finance_guard_refund_link BEFORE INSERT ON refund_links FOR EACH ROW EXECUTE FUNCTION guard_finance_refund_link();
