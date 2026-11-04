CREATE TABLE household_setup (
  workspace_id text PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  timezone text NOT NULL,
  bills_skipped boolean NOT NULL DEFAULT false,
  invite_skipped boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
CREATE TABLE opening_cutoffs (
  account_id text PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  through_date date NOT NULL,
  statement_balance numeric(14,2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE pilot_feedback (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('suggestion','blocked','financial','privacy')),
  message text NOT NULL CHECK (length(message) BETWEEN 5 AND 800),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','investigating','resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX pilot_feedback_member ON pilot_feedback(workspace_id,actor,created_at DESC);
--> statement-breakpoint
-- Refusing a receipt rolls back every new entry in the same approval transaction.
CREATE FUNCTION enforce_import_cutoff() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.receipt IS NULL AND NEW.receipt IS NOT NULL AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.receipt) decision
    JOIN transactions t ON t.id=decision->>'transactionId' AND t.workspace_id=NEW.workspace_id
    JOIN opening_cutoffs c ON c.account_id=t.account_id AND c.workspace_id=t.workspace_id
    WHERE decision->>'action'='import' AND t.date<=c.through_date
  ) THEN RAISE EXCEPTION 'Statement opening date already covers this entry'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER file_import_opening_cutoff BEFORE UPDATE OF receipt ON file_imports
FOR EACH ROW EXECUTE FUNCTION enforce_import_cutoff();
--> statement-breakpoint
CREATE INDEX transactions_activity_order ON transactions(workspace_id,date DESC,created_at DESC,id DESC);
--> statement-breakpoint
CREATE INDEX transfers_activity_order ON transfers(workspace_id,date DESC,created_at DESC,id DESC);
--> statement-breakpoint
CREATE FUNCTION protect_shared_closure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM workspaces WHERE owner_id=OLD.id ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id
    WHERE w.owner_id=OLD.id AND m.user_id<>OLD.id) OR EXISTS
    (SELECT 1 FROM workspaces w JOIN invitations i ON i.workspace_id=w.id WHERE w.owner_id=OLD.id)
  THEN RAISE EXCEPTION 'Resolve household ownership and invitations before closure'; END IF;
  RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER guard_shared_closure BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION protect_shared_closure();
--> statement-breakpoint
-- Older clients can still import in trackers without cutoffs. Use the same lock as
-- the setup and reviewed import paths so a concurrent confirmation cannot be missed.
CREATE FUNCTION import_legacy_entries(w text, actor text, entries jsonb) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE inserted integer;
BEGIN
  PERFORM 1 FROM workspace_members WHERE workspace_id=w AND user_id=actor AND role IN ('owner','member') FOR SHARE;
  IF NOT FOUND THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('file-import:'||w,0));
  IF EXISTS(SELECT 1 FROM opening_cutoffs WHERE workspace_id=w) THEN RETURN 0; END IF;
  INSERT INTO transactions(id,workspace_id,type,amount,date,note,account_id,category_id)
    SELECT gen_random_uuid()::text,w,r.type,r.amount,r.date,r.note,r."accountId",r."categoryId"
    FROM jsonb_to_recordset(entries) AS r(type tx_kind,amount numeric,date date,note text,"accountId" text,"categoryId" text);
  GET DIAGNOSTICS inserted=ROW_COUNT;
  RETURN inserted;
END $$;
