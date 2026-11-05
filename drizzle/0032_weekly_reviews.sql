-- Review metadata is separate from ledger postings. Membership removal also removes that member's review state.
CREATE TABLE weekly_review_progress (
  workspace_id text NOT NULL,
  actor_id text NOT NULL,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  decisions jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(decisions) = 'object'),
  PRIMARY KEY (workspace_id, actor_id),
  FOREIGN KEY (workspace_id, actor_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE weekly_review_receipts (
  workspace_id text NOT NULL,
  actor_id text NOT NULL,
  id text NOT NULL,
  request_hash text NOT NULL,
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, actor_id, id),
  FOREIGN KEY (workspace_id, actor_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX weekly_review_receipts_recent ON weekly_review_receipts(workspace_id, actor_id, completed_at DESC, id);
