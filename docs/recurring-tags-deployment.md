# Recurring tags: deployment notes

This release requires `drizzle/0010_recurring_tags.sql` before deploying the application.
It adds `recurring.tag_ids` as non-null JSON with an empty-array default. It does not
remove tables, rewrite transactions, change balances, or backfill historical tags.
The previous application remains compatible with the added column.

1. Take a fresh production backup with the migrations from the currently deployed
   release (`scripts/backup-db.ts --production --env=<ignored-env-file>
   --migrations=<previous-release-drizzle-directory>`). The backup tool performs a
   restore rehearsal and saves the matching migrations with the snapshot.
2. Restore that backup into an isolated database, apply the new migration, and
   confirm every original row is unchanged and existing recurring tag arrays are empty.
3. Inspect migration history. Apply only the reviewed additive migration through
   the migration runner; never use schema push, database reset, seed, or a restore
   against the live database. Record the migration in Drizzle's migration journal.
4. Deploy the application. Verify the dashboard and subscription editor without
   adding test financial records to production.
5. Take another verified backup and compare it with the baseline using `--compare`.
   The comparison treats a missing pre-migration tag field as an empty array; it
   still detects changes to previously saved tags and existing financial rows.

Tags are workspace-scoped and copied atomically when future recurring transactions
are posted. Editing tags does not change past transactions. Older clients that omit
`tagIds` when editing a rule preserve its current tags.

If application rollback is needed, leave the additive column in place and roll back
only the application. Do not overwrite newer live data with the backup.
