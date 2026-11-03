# M2: saved statement reviews

Started 31 October 2026. This covers the M2 statement review workflow, including the discrepancy investigation and verified corrections added on 3 November 2026. The existing quick balance comparison remains available. The follow-up [reviewed file imports](reviewed-file-imports.md) implementation adds CSV/Excel staging, reusable mappings and durable import receipts in the isolated preview.

## Workflow

From an account, choose **Review statement**, enter the inclusive statement dates and closing balance, then review each income, expense and transfer. Starting balance includes all ledger entries before the first date. The user must compare that balance with the statement opening balance.

Entries are unreviewed, cleared on the statement, or outstanding. Outstanding entries remain in the ledger but are excluded from the cleared closing balance. Completion requires an exact two-decimal match, a decision for every period entry, and explicit acknowledgement of possible duplicates (same date, kind and signed amount). Candidates are suggestions, not proof of duplicate payments. No automatic correction or balancing transaction is created.

Saved drafts survive page reloads. Reviewers share optimistic versions: an older screen cannot overwrite a newer save. Starting a review has a reusable request identity. A lost save response is resolved by reloading the saved review; retrying an old version cannot write twice. Each start/save/completion records its actor and timestamp in the session event history.

## Preserving evidence and detecting changes

Each review retains its account opening balance, display currency, and relevant ledger entries through the inclusive closing date. Every read and final save compares this snapshot against current data. Changes to the opening balance, currency, amount, date, account, type, note, added/deleted entries, or transfers mark the result **Needs review**, including changes made through older clients, cron or direct database operations. This deliberately conservative check can invalidate a review for note-only edits. Activity strictly after the closing date does not invalidate it.

The stored completion event is immutable evidence of what was reviewed then; it is not proof that current data still matches. The effective status is derived on read, including when listing saved reviews. New corrections require a new review; the previous evidence is retained. No background notification is sent. Two identical states separated by an unobserved edit-and-revert cannot be detected until the remaining M1 mutation-audit coverage exists.

The account reference intentionally has no cascading foreign key, retaining evidence if an account is removed. Workspace and actor rules follow the existing workspace lifetime. Only owners/members can start or save; viewers can read. Membership is enforced in the database statement, not solely in the browser.

## Investigating a discrepancy

Open a changed review to see the original and current entry details. Rows that move outside the account or period are described as leaving the review: their absence does not establish deletion. The display shows up to 50 changed entries, with the full count. Opening balance and currency changes are reported separately.

After checking and saving all entry decisions, an editor can record a verified missing income or expense against a discrepant draft. Copy its actual posting date and amount from the statement, describe the item, and enter the reason. An existing entry of the same kind, date and amount requires explicit confirmation that the new one is separate. There is no suggested amount or one-click balance adjustment. Use the normal transfer flow for transfers.

Recording creates one labelled ledger transaction plus its creation history and statement event in a single database statement. The app checks current membership, active account, review version and ledger snapshot. A retry with the same identity cannot post twice. The review remains **Needs review** after a correction, even if someone later deletes the entry. Start fresh with the same dates and closing balance to verify the result. Only one correction can be recorded from a particular saved review. For multiple missing items, consider the reviewed file importer.

Transaction history and the Excel export retain the reason, actor and references. Reuse the existing review and transaction history tables; no third migration or historical backfill. The correction action requires both statement reviews and `STATEMENT_CORRECTIONS_ENABLED=1` (off by default, on in isolated preview). When deploying later, retain a fresh verified backup and test hosted concurrent writes before enabling it.

## Data and release

- `0012_statement_reviews.sql` only creates `reconciliation_sessions`, its own constraints and index. Existing financial tables and rows are not rewritten.
- `STATEMENT_REVIEWS_ENABLED=1` enables the route, actions, account link and export sheets. It is off by default in production, and on in the isolated preview.
- Backups include the new table when present. While source production is still on the previous schema, the backup selects a compatible pre-M2 migration journal for its isolated restore rehearsal. The source is never migrated by the backup script. Unknown tables and future unreviewed migration combinations still fail closed.
- Excel export includes statement metadata, one row per captured entry, and event/decision rows. Saved status is explicitly historical; reopen the app review to check current validity. Exported snapshots never silently rewrite transactions on import.
- Latest 20 reviews appear in the account screen; a review displays 25 entries per page. At most 5,000 entry decisions can be saved for one statement. Broader history browsing and native UI remain pending.

Before production enablement: fresh encrypted backup plus restore rehearsal, review/apply only the additive migration, verify preservation of all existing financial rows, verify actual Neon save/concurrency behavior with disposable data, deploy disabled, then enable and check the authorized workflow. Keep the table and new reviews if rolling back application code. Never restore an older database over newer financial activity.

## Validation

The isolated suite covers missing fees, duplicate purchases, refunds, transfers, outstanding amounts, period boundaries, exact cents, repeated starts, version conflicts, permissions and changes made between read and save. Completed-review invalidation covers opening balance, currency, edits, deletions, account movement and new entries. A synthetic old-schema/new-schema backup rehearsal verifies decryption, restoration and preservation of original rows.

Verified locally on 31 October 2026:

- `npm test`: 156 tests passed across 14 files, including the authenticated actions and workspace-scoped Excel export.
- Targeted ESLint passed for the changed source and new tests. `npm run build:preview` passed, including TypeScript and the new statement route.
- Synthetic old-schema and new-schema encrypted backups both passed decryption and restore rehearsals, retaining the original financial rows. These are disposable verification fixtures, not production recovery backups.
- Browser verification: saved choices survived a reload; completion required duplicate acknowledgement even at zero difference; a completed review became **Needs review** after a sample expense changed, with the original evidence retained. No browser errors were recorded for this workflow.
- A narrow viewport check found no horizontal page overflow. Physical mobile devices and native app screens were not tested in this slice.

Evidence screenshots are in the ignored local folder `.codex/statement-review/`. No production access, migration, push or deployment was performed in this implementation turn. Actual Neon concurrency and the production release gates above remain unverified.

**3 November closeout:** 189 automated tests passed across 15 files using two workers. Tests covered explicit expense and refund corrections, authorization and rollout flags, exact decimal amounts, stale reviews, competing submissions, replay after deletion, rollback of both audit records, and Excel evidence. Browser verification used a disposable demo ledger: a verified 2.50 fee moved its balance from 100.00 to 97.50, the original review retained its 2.50 discrepancy, and a fresh review completed only after explicitly clearing the fee. No live account or database was accessed. Browser captures are in `.codex/statement-closeout/`.
