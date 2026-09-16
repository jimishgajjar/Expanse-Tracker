# Redesign delivery and data safety

## Database boundary

This change requires no schema migration, backfill, data reset, or seed against production. No production deployment or database connection was performed during implementation. Existing migrations, table definitions, environment files, and historical data were not changed.

Use `npm run dev:preview` to test the application at http://localhost:3107. The launcher explicitly clears DATABASE_URL and external email/push credentials in its child process and uses the git-ignored `.pglite-preview` directory. Only this separate embedded database is migrated and seeded with synthetic demo data. Sign in with demo@demo.com / password. Never use this preview database for real financial records.

`npm run build:preview` performs a production build under the same isolated environment. It is a validation command, not a deployment. Stop the preview dev process before building because both use `.next`.

## Delivered

- Responsive desktop sidebar, phone/tablet navigation, Overview, unified Activity, Accounts, Planning, and Insights.
- Clearer balance and period summaries, recent activity, upcoming payments, and budget warnings.
- Accessible transaction/account forms, mobile transaction sheet, in-memory draft retention, larger controls, explicit currency save, and role-aware controls.
- Existing accounts, transactions, transfers, categories, budgets, recurring rules, goals, splits, sharing, reports, imports, exports, and authentication remain available.
- Workspace ownership checks for account/category/tag references before writes.
- Atomic recurring posting and rule advancement, preventing duplicate posting by concurrent workers reading the same rule state and rolling back failed postings.
- Atomic password reset consumption and revocation of other sessions after a password change.
- Mobile login throttling, local-only redirect validation, explicit cron failures, and duplicate-notification claim checks.
- New goals retain the database-generated ID for subsequent actions.

## Verification

- 28 tests passed across four test files. Vitest reported a shutdown warning after completing successfully.
- Production build and TypeScript passed via `npm run build:preview`.
- `npm run lint`: zero errors, two pre-existing unused-variable warnings in postcss.config.mjs and scripts/seed.ts.
- Browser checks at 1280, 768, and 390px found no page overflow. Corrected and rechecked the mobile sheet bounds. A synthetic expense saved correctly; draft retention, navigation, settings, and dark mode were checked.
- `git diff --check` passed; schema, migration, lockfile, and environment files have no changes.

Automated tests use in-memory PGlite. They cover workspace isolation, foreign references, recurring processing races and rollback, retention of historical entries, password reset replay and session revocation, safe redirects, transfer feed ordering, date utilities, and analytics.

Browser checks use only the isolated synthetic demo account. Desktop, tablet, and phone layouts are inspected alongside form entry, draft retention, feature navigation, and settings.

## Production rollout

Deploy application code using the existing production DATABASE_URL. No `db:push`, `db:migrate`, or `db:seed` command is needed for this change. Before a later production rollout, create and verify a provider snapshot/restore point using your normal backup process, then smoke-test against a staging copy. Keep the previous application deployment available for rollback. The verified backup command below is the deployment gate. Keep backup folders private and excluded from Git.

The broader review's ideas—bank reconciliation, duplicate-aware import preview, receipt attachments, durable offline drafts, and server-side report pagination—remain follow-up work. This delivery does not claim those new features.

## Verified backup procedure

With the existing production connection saved only in a Git-ignored environment file:

```sh
npx tsx scripts/backup-db.ts --production --env=.env.production.backup.local
```

The script uses a read-only repeatable-read source transaction, exports all application tables plus schema and migration metadata, checks the files on disk, and rehearses restoring the saved records into a new in-memory Postgres instance. It stops on unknown tables, schema differences, missing credentials, or a failed restore. It never runs migrations or writes against the source. The copied repository migrations document the application schema; this is an application-data backup, not a physical backup of database roles or provider configuration.

After deployment, run the same command with `--compare=backups/backup-<before-deployment-timestamp>`. The comparison checks that existing financial records, users, memberships, invitations, and push subscriptions remain present and unchanged, while permitting new rows. Recurring scheduling counters and reminder timestamps may advance normally; its rule settings must remain unchanged. Sessions, reset tokens, rate limits, and notification deduplication records are backed up but excluded from this comparison because normal authentication and scheduled jobs can change them. Investigate any difference before taking recovery action; never overwrite newer live data automatically.

The backup procedure was verified against synthetic data, including deliberate alteration of an old transaction to confirm the comparison rejects it, before production use.
