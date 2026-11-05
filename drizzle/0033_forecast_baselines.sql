-- Explicitly saved forecast evidence only. This migration does not change ledger rows.
CREATE TABLE forecast_baselines (
  workspace_id text NOT NULL,
  actor_id text NOT NULL,
  id text NOT NULL,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  request_hash text NOT NULL,
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id, actor_id, id),
  FOREIGN KEY(workspace_id, actor_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX forecast_baselines_recent ON forecast_baselines(workspace_id,actor_id,account_id,created_at DESC,id);
