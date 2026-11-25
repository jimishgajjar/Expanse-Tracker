-- Per-person display preferences (for example the Overview layout), synced across devices.
-- Additive only: no existing table or row changes.
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "user_preferences_pk" PRIMARY KEY ("user_id", "key"),
  CONSTRAINT "user_preferences_key_length" CHECK (length("key") BETWEEN 1 AND 160)
);
