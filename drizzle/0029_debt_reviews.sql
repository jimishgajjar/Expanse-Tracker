CREATE TABLE finance_accounts (
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('cash','asset','card','loan')),
  reviewed_balance numeric NOT NULL,
  adjustment numeric NOT NULL,
  interpretation text NOT NULL CHECK (interpretation IN ('signed','owed')),
  reviewer text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,account_id)
);
--> statement-breakpoint
CREATE TABLE debt_statements (
  workspace_id text NOT NULL, account_id text NOT NULL, starts date NOT NULL, ends date NOT NULL,
  due date NOT NULL, closing numeric NOT NULL, minimum numeric NOT NULL CHECK (minimum>=0),
  PRIMARY KEY(workspace_id,account_id,ends),
  FOREIGN KEY(workspace_id,account_id) REFERENCES finance_accounts ON DELETE CASCADE,
  CHECK (starts<=ends AND ends<=due AND minimum<=greatest(closing,0))
);
--> statement-breakpoint
CREATE TABLE loan_terms (
  workspace_id text NOT NULL, account_id text NOT NULL, apr numeric NOT NULL CHECK(apr BETWEEN 0 AND 100),
  payment numeric NOT NULL CHECK(payment>0), monthly_fee numeric NOT NULL CHECK(monthly_fee>=0),
  variable boolean NOT NULL, PRIMARY KEY(workspace_id,account_id),
  FOREIGN KEY(workspace_id,account_id) REFERENCES finance_accounts ON DELETE CASCADE
);
