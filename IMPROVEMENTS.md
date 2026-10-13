# Everyday finance improvements

Scope: all eight approved improvements. Preserve historical amounts, references, permissions and the current visual language.

1. Defer Insights and workspace tools; measure before/after initial loading.
2. Paginate Activity in the database with server-side filters and accurate full-filter totals.
3. Expand workspace exports; schedule encrypted local backups with restore verification and visible status.
4. Recent categories, favourite accounts, repeat transaction, save and add another.
5. Actionable upcoming-payment and budget summaries with relevant destinations.
6. Compare statement balances without automatic ledger adjustments.
7. Record future transaction edits and show previous values and actors.
8. Shared loading/error states and compact/comfortable density with accessible mobile targets.

Release gates: isolated database tests, lint, typecheck, production build, browser checks, fresh verified production backup before additive migrations, before/after financial-row comparison, normal Git push under Jimish Gajjar, Vercel commit and domain verification. Never restore an older snapshot over newer production data.

Backup destination: encrypted files on this Windows computer; catch up missed runs when available. Recovery needs the encryption key, which must be kept separately from the backup files.


## Delivered and checked (13 October 2026)

- Overview now fetches grouped chart data and five recent entries. Insights and secondary workspace tools load only when opened. A 2,000-row isolated fixture returns one chart aggregate and five recent entries, retains the exact total, and reduces this data payload to less than one tenth of its raw-ledger representation. This is a payload test, not a production latency measurement.
- Main Activity filters, full-filter totals and page selection run in one database query; 10/25/50/100-row pages. Account/category detail pages retain their existing filters.
- Excel export has 13 sheets including transfers, recurring rules, goals, tags and edit history. Verified by downloading and parsing the demo workbook.
- Favourite accounts and recent categories are browser-local; repeat uses today's date; save-and-add retains the account/category and clears amount/note/tags. Demo browser verification passed.
- Overview includes upcoming payments, current budget status and a link to period expenses.
- Account Check balance compares a statement date/balance with the ledger including transfers. It never creates adjustment transactions or marks entries as reconciled.
- Future transaction edits are captured atomically with previous/new values and editor identity. Earlier history cannot be reconstructed. Creation/deletion history and transfer edits are outside this feature.
- Compact/comfortable preferences, shared loading/retry/empty states, compact row menus and phone layout checked at 390px without horizontal overflow.

Validation: 61 tests across eight files passed; lint, TypeScript and optimized production build passed. Browser checks covered transaction edit/history, repeat/save-and-add, paging, empty search, deferred Insights/Planning/goals, density, statement matching and Excel export. Preview writes were restricted to the isolated demo database.

Production safety: encrypted baseline `backup-2026-10-13T18-51-05-825Z.etb` restored successfully (395 rows). Guarded migration added only transaction_history and backup_reports. A new encrypted backup restored successfully and verified existing financial rows unchanged against the baseline. Scheduled task's actual unattended run returned LastTaskResult=0, generated `backup-2026-10-13T18-53-29-819Z.etb` (396 rows including backup-status metadata), and passed restore verification.

Schedule: daily 20:00 Toronto/current computer time zone, signed-in Windows user, catch-up enabled. See BACKUP-RECOVERY.md for recovery and computer/key-loss limitations.
