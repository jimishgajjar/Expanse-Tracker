# Household pilot

## Start an isolated rehearsal

Run `npm run dev:pilot` and visit `http://127.0.0.1:3140/signup`. A new household starts with categories and no accounts or transactions. The separate local demo login has example activity. The pilot preview disables email, push and external bank connections. The setup page is also in Settings. The default date on Overview uses the saved household time zone. Existing recurring rules keep their saved dates.

An owner enters the account's opening balance when creating it. In Setup, preview its recorded balance through the statement date. Confirm only if it matches the actual statement. File review then permits matching and ignoring covered entries and refuses to post them as new transactions. The check also runs inside approval of an older batch. Opening confirmations never rewrite recorded transactions or the account opening amount. Reviewed currency and liability accounts use their financial position review.

## Before anyone is invited

1. Nominate an operator and a backup contact. Agree on supported hours, escalation contact, retention periods and deletion of pilot observations. Give participants these details before consent.
2. Use a separate pilot environment. Verify rejected viewer writes, stale-tab submissions, removed memberships, private exports and household switching in the actual environment. Inspect its feature flags, mail delivery, storage location, access to backups and feedback, and restricted operator access.
3. Take an encrypted backup, restore it into a new isolated database, compare contents and exercise sign-in/export against that copy. Record elapsed recovery time and age of the latest successful backup against the 4-hour recovery and 24-hour data-loss targets. Never restore a rehearsal over the source.
4. Obtain consent from each participant for each observation. Let them decline or stop. Use a synthetic statement for observed imports and avoid recording screens, credentials, counterparties or financial amounts. Participation and timing collection are separate choices.
5. Arrange access for up to five households only after the gates above pass. Record the environment and build once for the cohort. A wider public release requires jurisdiction-specific privacy, retention, incident response and provider review.

## Six observed tasks

For M11 use the [facilitator worksheet](m11-household-observation.md) and [practice statement](pilot-statement.csv). Run `npm run rehearse:household-pilot` to check the fixture in a fresh in-memory database. A second mode, `npm run rehearse:household-pilot -- --hosted`, requires an operator-provisioned empty synthetic Neon database in `PILOT_REHEARSAL_URL` and its independently verified `PILOT_REHEARSAL_PROJECT`. The script checks both identities before applying migrations. Each hosted run needs its own empty database.

| Task | Prompt | Completion evidence |
| --- | --- | --- |
| Setup | Set preferences, add an account, confirm a matching opening statement, leave and resume. | Saved preferences, account and date visible on return. Record the first five outcomes in order. |
| Manual capture | Enter a familiar expense and find it again. | Correct account and amount, one entry. Time from opening capture to confirmation. |
| Import review | Preview a file containing an existing payment and a later entry. | Match the existing entry, import the new one and reopen the receipt. |
| Reconciliation | Compare a statement with the tracker. | Explain any difference before completing the review. |
| Forecast | Find the next low-balance date or explain why none is forecast. | Participant can identify the assumption that drives it. |
| Weekly review | Find the household check-in. | Identify the next action for bills, reimbursements or goals. |

Record distinct households attempting each task, unassisted completions and assisted completions. Include unfinished attempts in the denominator. Track reasons for failures separately, with permission. At week four count eligible original households and how many returned. Do not count new signups as retained households.

## Feedback and closure

Members can submit a private report and see their own recent references and status at `/feedback`. Stop the dedicated local preview before using `npm run pilot:triage -- list`. To inspect a report or change its status use `read <reference>` or `set <reference> investigating|resolved`. Restrict triage to the operator. This local command is tied to the pilot data directory. On approved staging, use separately authorized operator access limited to the feedback table.

| Kind | Operator action and pilot response target |
| --- | --- |
| Unexpected financial movement or privacy exposure | Pause the affected pilot flow immediately. Acknowledge when staffed, preserve evidence, establish scope and validate recovery before resuming. |
| Blocked task | Acknowledge by the next staffed working day. Reproduce with synthetic data and provide a safe workaround if one exists. |
| Suggestion | Review at the weekly pilot check-in. |

These are pilot operating targets. Agree on coverage before enrollment. Sign-off for a fix requires reproducing the original failure, a passing regression check, and a follow-up with the reporter through their agreed contact channel. Closing a ticket alone does not establish resolution.

Users export through Settings. A regular workbook has multiple worksheets. Oversized workbooks stop before eager loading and offer separate 500-row CSV downloads for transactions and transfers. CSV parts are ordered by stable record ID. Download during a quiet period. They do not represent a frozen snapshot or include plans and reviews. For a complete large-household export the operator must generate a household-scoped copy in an isolated restore, validate its contents and deliver privately. Never give a participant a multi-household recovery archive. Verify the export before closing an account. Closure requires the current password. Shared trackers with other members or outstanding invitations require ownership resolution. Removing a login does not expire offline archives. Agree on backup retention and any recovery-time deletion handling with the operator.

## Measure before setting a price

Copy `docs/pilot-evidence.empty.json` outside version control. Use one month, one currency and invoice-backed amounts allocated to this app. Record provider, hosting, storage and notification costs separately. For shared services, document the allocation basis outside the evidence file. A documented zero is a valid amount. Unknown amounts stay null. Use distinct active households as the denominator. Log support minutes, including onboarding and incident follow-up. Do not enter individual identities or financial records.

Settings → Optional pilot page timings stores up to 90 samples for the consenting tab and tracker. Reload after enabling timing, perform typical tasks, then show the timing values. Combine raw measurements by device class. Record LCP and INP in milliseconds, CLS as a unitless score. Distinguish full reloads from app navigation, and development sessions from the deployed build. No samples are uploaded automatically. Stop and clear the tab's samples after collection.

Run `npm run pilot:report -- <evidence-file.json>`. The report calculates first-five setup success, capture median, retention, support minutes per active household, cost per active household and device-specific p75 timings with sample counts. Compare with the roadmap targets. A missing measurement remains unknown. There are no observed households, invoices or pricing conclusions in the supplied template.

## Reproduce the engineering checks

- The implementation run passed 316 automated tests across 46 files. `npm test` exercises tracker permissions, stale imports, cutoffs, legacy and reviewed financial flows, chunked output and the pilot scorecard.
- `npm run benchmark:ledger -- --stdout` exercises isolated 1k, 10k and 100k ledgers. The 100k pre-change / post-change warm medians in milliseconds were 141 / 117 for the first page, 258 / 229 for filtered search, and 262 / 184 for the last page. The corresponding warm p95 values were 171 / 123, 365 / 242 and 266 / 187 ms. Seven warm samples per case are diagnostic. These are database query measurements, excluding network, server and browser time.
- `npm run rehearse:pilot-load` uses a disposable local PostgreSQL 17 container with no host port or volumes. It overlaps a reader, a ledger edit, competing recurring workers and the real observation sync code with a synthetic provider. It checks exact totals, one posting and one separately staged observation.
- `npm run rehearse:m8-backup` passed encrypted backup and restore at migration levels 28, 29, 30 and 31. The last archive contained 21 synthetic rows, including opening-cutoff and feedback records. The comparison retained all earlier financial rows.
- With the pilot preview running and Playwright/Chromium installed, `node scripts/check-pilot-browser.cjs` passed with a new synthetic household. It exercises labelled controls, keyboard submission, saved progress, private feedback and the empty export on mobile-sized and desktop Chromium. Optional local paths can be supplied via `PILOT_PLAYWRIGHT_PATH` and `PILOT_CHROMIUM_PATH`. Assistive-technology testing with a human participant and staging performance still require separate evidence.
