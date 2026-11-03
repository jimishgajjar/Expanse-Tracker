# M2 hosted rehearsal — 3 November 2026

Passed on disposable Neon PostgreSQL 17.11 using the application's Neon HTTP driver and actual import/correction store functions. No production connection, backup, migration or deployment was performed. No live rows were copied. The temporary project is unclaimed and expires independently of the live application.

The harness verified the expected Neon project ID and an empty public schema in its control database, then created a uniquely named test database. It installed the pre-M2 schema, inserted two synthetic accounts and one existing expense, and applied migrations 0012 and 0013. The original account and expense records compared equal before and after the migrations and at the end of the rehearsal.

| Exercise | Observed result |
| --- | --- |
| Two editors approve the same two-row file concurrently, then retry after ignoring the first response | Two distinct blocked PostgreSQL writer sessions were observed before release. Both editors and the retry received the same receipt. Exactly two transactions and two creation histories appeared, with the expected IDs, amounts and types. |
| Two editors record the same missing fee against the same statement version, then the winner retries | Two blocked writers were observed. One correction succeeded, the competing correction was rejected, and the retry returned the original review. One new expense, one creation history and one statement correction event were recorded. |
| The database rejects the second row in an approved batch | No new ledger or history rows remained; the batch still had no receipt. After removing the synthetic failure, the same batch posted exactly two rows. |

Reproducer: `scripts/rehearse-m2-hosted.ts` uses only an explicitly provided `M2_REHEARSAL_URL` and matching `M2_REHEARSAL_PROJECT`. Use a fresh, disposable Neon project only. The harness does not load application env files or fall back to `DATABASE_URL`.

These results verify the tested hosted write paths, not the state or recoverability of the live database. Before a production release, make a fresh encrypted backup, restore and verify it in isolation, deploy with new features disabled, and compare existing financial rows and balances before enabling them. An old backup must not overwrite newer live activity.
