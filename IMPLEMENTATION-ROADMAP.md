# Finance Tracker implementation roadmap

**Next phase, proposed 4 November 2026.** Start with [M11 through M15](#next-phase--m11-through-m15). The November 4 release brought the web milestones together. The five-household pilot, physical-phone acceptance, and a production bank connection still require separate evidence.

Prepared: 31 October 2026, America/Toronto.
Status: proposed implementation backlog; this document does not authorize paid services, activate bank access, change the database, or claim completed implementation.

Implementation started 31 October 2026: M0 capability inventory/synthetic query baseline and the M1 manual-create integrity slice. See [financial-foundation.md](docs/financial-foundation.md) for scope, verification and remaining gates. Full milestones remain incomplete until their acceptance criteria pass.

M2 started 31 October 2026: saved statement reviews, exact-balance completion and detection of subsequent ledger changes. This is the reconciliation slice; reviewed CSV/Excel staging and durable import provenance were implemented locally on 3 November 2026 (see [reviewed-file-imports.md](docs/reviewed-file-imports.md)). Hosted concurrency was verified with synthetic data, and M2 shipped on 3 November 2026. See [statement-reviews.md](docs/statement-reviews.md). M3 bank connectivity is separate and is not enabled in production.

## 1. Product outcome and scope

Build a trustworthy household finance product for Canadian households first, with web and native mobile access. The promise is: **Understand what you can spend, and trust every number.**

The strongest case against implementing everything at once is complexity: bank sync, shared access, offline writes, foreign exchange, and budgeting can each introduce conflicting interpretations of the same money. Deliver complete, independently gated workflows in sequence. More features or another redesign alone will not establish product quality.

All ten improvement areas are included below. Initial users are the existing household, followed by a small invited pilot. International support follows correct Canadian CAD workflows. Investment trading, payments, tax filing, and business accounting are outside this roadmap. Optional AI explanations are a later extension; deterministic calculations remain authoritative.

Success means users can establish accurate balances, capture or review spending quickly, reconcile statements, anticipate cash shortfalls, and coordinate household money without maintaining a spreadsheet alongside the app.

## 2. Verified baseline and existing plans

Repository review confirms Next.js 16, React 19, Drizzle, a production Neon HTTP database path, local PGlite, and an Expo SDK 54 mobile codebase. Read installed Next.js guides before implementation; check compatible mobile dependencies before upgrades. Do not rewrite the stack to execute this plan.

| Existing capability | Build on it; do not claim it is missing |
| --- | --- |
| Accounts, income/expenses, transfers, categories, tags | Preserve IDs, amounts, dates, account references, routes, and existing manual workflows. |
| Monthly budgets, recurring bills, savings goals, shared-expense IOUs | Extend semantics rather than introduce competing totals. |
| Paginated Activity, deferred tools, aggregate Overview queries | Measure real performance before further optimization. |
| Statement balance comparison | Add persistent reconciliation and discrepancy investigation. |
| Transaction edit history | Extend future audit coverage; do not invent historical events. |
| Excel export and encrypted local backups | Extend schema coverage and independent recovery. |
| Expo app and mobile APIs | Verify feature parity and physical-device behavior rather than treat existing screens as acceptance. |
| Local RBC/TD simulator | Reuse domain scenarios; it is not a production provider adapter. |

Reference documents:

- [PRODUCT.md](PRODUCT.md): audience and product principles.
- [IMPROVEMENTS.md](IMPROVEMENTS.md): previously delivered improvements and dated verification receipts.
- [BANK-SYNC-IMPLEMENTATION-PLAN.md](BANK-SYNC-IMPLEMENTATION-PLAN.md): detailed bank architecture and provider-specific test matrix.
- [BANK-DEMO.md](BANK-DEMO.md): local synthetic demo and its limits.
- [BACKUP-RECOVERY.md](BACKUP-RECOVERY.md): current recovery procedure and machine/key-loss limitations.
- [mobile/IMPLEMENTATION_PLAN.md](mobile/IMPLEMENTATION_PLAN.md) and [mobile/INSTALL_IOS.md](mobile/INSTALL_IOS.md): existing native work and distribution setup.

This roadmap governs cross-feature order. The bank plan remains the detailed bank specification; revalidate its dated vendor assumptions before implementing external services. Earlier test counts and backup receipts are historical, not a fresh production audit.

## 3. Non-negotiable financial and data rules

1. No production resets, seeds, destructive schema pushes, or automatic restoration of an old snapshot over current data.
2. Use additive schema changes initially. Rehearse each migration on an isolated restored copy; never convert historical currencies or amounts by changing a display setting.
3. Bank synchronization writes a separate feed. Only explicit, authorized review actions post to the ledger initially. Manual and scheduled entries participate in duplicate checks.
4. Preserve the distinction between ledger balance, bank current/available balance, forecast, budget allocation, and savings reservation. Credit limits are not spendable cash.
5. Transfers and credit-card repayments do not count as income or spending. Interest and fees do. Refunds link to spending or remain unresolved; do not silently classify them as salary/income.
6. Every money-changing operation must be atomic, workspace-scoped, auditable, and safe to retry. Share these rules across web, native APIs, scheduled posting, imports, and undo.
7. Bank updates, rules, currency conversions, and reconciliations must not silently overwrite user decisions.
8. Use decimal-safe arithmetic with explicit rounding and currency precision. CAD uses cents; future currencies cannot assume every currency has two decimal places. Keep bank date-only fields separate from UTC event timestamps and workspace calendar dates.
9. Local and automated test environments use synthetic data and disabled production credentials. Real bank passwords never enter app-owned forms, fixtures, logs, screenshots, or chat.
10. Roll back application behavior with flags or compatible code; preserve newer financial data and additive tables. Correct disputed entries through audited actions, not bulk deletion.

No system can promise zero data loss under every failure. The release process must measure recovery exposure and prove restoration rather than advertise an absolute guarantee.

## 4. Delivery sequence and dependencies

| Milestone | Scope | Required before release |
| --- | --- | --- |
| M0 | Baseline, metrics, financial contracts, UX scenarios | Repository and current environment inventory |
| M1 | Mutation consistency, audit, recovery, access hardening | M0 |
| M2 | Statement reconciliation and reviewed file imports | M1 |
| M3 | Real bank integration: Sandbox, observation, reviewed imports | M1 + M2 + provider access |
| M4 | Merchant rules, split purchases, receipts, bulk review | M1 + M2; validate bank behavior after M3 |
| M5 | Flexible budgets and money-backed goals | M1 + reconciliation model from M2 |
| M6 | Forecasts and decision-focused dashboard | M5; supports manual data, enriched by M3 |
| M7 | Household ownership, permissions, reimbursements | M1; before inviting external households |
| M8 | Credit cards, loans, multicurrency | M2 + M5 + M6; rerun bank/rules tests |
| M9 | Native parity, offline drafts, device acceptance | M1 contracts; each corresponding web workflow stable |
| M10 | Onboarding, pilot, performance and launch readiness | M1-M7 and relevant M9 flows; M8 may follow initial CAD pilot |

Local rule, budget, mobile, and onboarding work can proceed while bank-provider access is pending. A missing bank account must not block independent work. This is sequencing, not a request to launch all milestones in one release.

## 5. Milestone implementation backlog

### M0 — Establish measurable truth

- [ ] Record current schema/migrations, deployed commit, enabled features, web/mobile endpoints, and actual backup status without exposing secrets.
- [ ] Capture synthetic fixture balances and expected totals for income, expenses, transfers, credit liabilities, refunds, splits, and recurring entries.
- [ ] Document amount/sign conventions, timezone/month boundaries, cancellation/undo semantics, permission roles, and the difference between posted and forecast amounts.
- [ ] Add a capability matrix covering each web feature, mobile screen/API, export, backup, and permission boundary.
- [ ] Establish privacy-preserving timing/error metrics: route latency, query latency, mutation failures, job age, and backup freshness. Exclude amounts, descriptions, tokens, account identifiers, and user-entered search text from telemetry.
- [ ] Baseline desktop/mobile loading and transaction entry on agreed devices, network conditions, and 1k/10k/100k synthetic transaction workspaces.
- [ ] Design one complete example of setup, capture, review, reconciliation, and weekly household review using existing visual conventions.

Primary files: `src/lib/db/schema.ts`, `src/lib/actions.ts`, `src/lib/mobile-api.ts`, `src/lib/queries.ts`, `src/components/overview-tab.tsx`, `mobile/src/`.

Acceptance: a versioned baseline receipt identifies what was measured, what is only documented, and what is still unknown. Existing flows pass before feature work begins.

### M1 — Financial integrity, recovery, and access

- [ ] Introduce a shared server-side mutation boundary incrementally; route existing web actions and mobile handlers through it without changing their public behavior.
- [ ] Add scoped idempotency keys and optimistic version checks. Ledger writes, relevant links, and audit events commit together. Validate actual Neon HTTP atomic primitives; do not rely on an unsupported interactive-transaction API or process-local locks.
- [ ] Extend audit coverage to create/update/delete/undo, transfers, opening-balance changes, recurring materialization, reconciliation, and later imports. Record actor, origin, entity version, timestamp, and minimal before/after values.
- [ ] Mark preexisting records as legacy baseline where needed; never fabricate historical editors or timestamps. Preserve existing edit history.
- [ ] Cover account archival/deletion and reference cascades explicitly. Retain provenance for financial corrections and prevent accidental cascade loss; select retention and erasure behavior before changing deletion semantics.
- [ ] Build backup destination adapters and a portable encrypted key-recovery/export flow. Keep existing local backups; add independent storage only after a destination is selected. A second directory on the same computer is not independent recovery.
- [ ] Make backup age/failure visible and implement a configurable notification channel. Test failure alerts with a test destination before enabling real messages.
- [ ] Review sessions, workspace authorization, sensitive-action reauthentication, rate limiting, and token storage. Add session/device revocation and select a maintained passkey/MFA implementation with recovery codes rather than inventing authentication cryptography.
- [ ] Add incident and lost-device runbooks; separate application session recovery from backup decryption recovery.

Acceptance: concurrent/retried requests create exactly one intended movement; unauthorized workspaces cannot read or mutate it; failures leave no partial ledger/audit write. A recovery drill succeeds in a clean environment without the original Windows profile. Report achieved recovery point/time, not just that a backup file exists.

Release: deploy compatible audit additions first. New backup destinations, auth recovery, and notification channels each require their own end-to-end evidence.

### M2 — Reconciliation and safe file migration

- [x] Local preview: add reconciliation sessions with statement account, date range, closing balance, matched entry revisions, difference, status, and actor.
- [x] Local preview: provide cleared/unmatched views, duplicate candidates, missing-entry investigation, and closing-balance explanation. Existing balance comparison remains available.
- [x] Local preview: permit completion only at an exact currency-precision match. A later amount/date/account edit or deletion invalidates the affected reconciliation and explains why; corrections require explicit review.
- [x] Local preview: build CSV/Excel preview staging with reusable column mapping, row errors, date/currency validation, duplicate review, and approved import batches. Upgrade the existing immediate importer incrementally.
- [x] Local preview: use durable import provenance and retry keys. Reimporting the same file or retrying a failed response must not silently duplicate entries; genuine identical purchases remain distinguishable by review.
- [x] Local preview: discrepancies never generate balancing entries. Verified corrections require an explicit amount, posting date, description and reason, and are linked to the original review in transaction history and exports.

Third implementation part (3 November 2026): investigate changes entry by entry and record a verified missing transaction. No additional database migration. Hosted multi-session rehearsal passed on 3 November 2026 with synthetic data (see [hosted rehearsal](docs/m2-hosted-rehearsal.md)). M2 subsequently shipped on 3 November 2026 at commit 603936d; the before/after checks verified the existing financial rows and account balances.

Acceptance: a fixture with a missing fee, duplicate purchase, transfer, and refund reconciles only after the specific issues are resolved. Completed periods flag subsequent changes. Partial file failures have explicit row outcomes and exports preserve provenance.

### M3 — Production bank connectivity

Started 3 November 2026. The [Sandbox provider check](docs/plaid-sandbox.md) runs independently of the ledger. The authenticated headless Sandbox check passed (one synthetic account, 69 transactions, cleanup confirmed). A separate local preview now implements owner-only Plaid Link, one-account selection, encrypted token persistence and a local bank inbox with explicit match, import and ignore decisions. See the Sandbox guide for validation boundaries. Actual RBC/TD coverage is unverified. Follow the detailed bank plan rather than copying the demo snapshot store into production.

- [ ] Verify Canadian RBC/TD institution, account-type, and Transactions coverage in the actual provider account. Check current terms, data permission scope, pricing, limits, and refresh behavior.
- [ ] Add real Link setup/exchange/update flows, encrypted versioned server-side tokens, owner/workspace authorization, selected-account mapping, and import cutoff.
- [ ] Add separate feed/import-link/review tables, durable outbox/jobs, verified webhooks, retries, fenced worker leases, and atomic cursor/feed commits.
- [ ] Exercise pending-to-posted changes, removed/modified entries, duplicate imports, pagination restart, missing account identities, reconnect/disconnect, and recurring-posting races.
- [ ] Implement explicit correction/reversal review and refund links. Ambiguous or unsupported cases remain unresolved rather than incorrectly changing totals.
- [ ] Show last successful sync, provider data timestamp where available, failed attempts, reconnect state, selected account, currency, and reviewed/unreviewed counts.
- [ ] Ship feature-disabled; then one selected account in observation-only mode; then a small reviewed batch; then the second bank. Keep automatic posting off.

Acceptance: Sandbox proves API contracts; staging proves production-driver concurrency; the live pilot proves actual bank behavior. Repeated sync changes no approved ledger rows, matching inserts no duplicate, and paired bank transfers create one transfer. Live acceptance includes initial history and a later provider update.

External gate: Plaid account/access and interactive user bank authorization. No deadline or free ongoing service is promised before these are confirmed.

### M4 — Transaction organization and capture

The local web preview supports split purchases. A single expense can carry 2–20 category portions; a save requires an exact total. Category reports and budgets use the portions, while account balances and statement reviews use the full purchase. The change includes an additive allocation table and export and backup support. Production rollout is pending.

Started with category suggestions in the web transaction form. An explicit lookup groups prior categorized entries by matching note, account and direction in the active workspace. The user sees usage counts and chooses whether to apply a suggestion to the draft. The local preview also supports account- and direction-specific merchant names and aliases, category/tag suggestions, priorities, and version history. Preview uses the same whole-word matcher on the current draft and up to 100 recent notes. Only an explicit choice applies a suggestion to the draft. Activity now previews category and tag changes for up to 25 selected transactions in the local preview. Apply rechecks saved state and history. Recent batches support per-entry undo, with conflicts reported individually.

- [ ] Add merchant aliases and deterministic category/tag rules with priority, conditions, version history, dry-run preview, and conflict explanations.
- [ ] Default rules to suggestions or changes on unreviewed entries. Applying a rule to existing reviewed history requires an explicit preview and audited batch action.
- [ ] Support splitting one purchase into category allocations whose sum equals the original amount exactly. Account balance counts the parent once; reports/budgets use allocations. Shared-expense IOUs remain a separate concept.
- [x] Local preview: bounded bulk category/tag changes, stale-preview checks, visible outcomes, and conflict-aware undo. Hosted rollout remains pending.
- [x] Local web preview: attach one JPEG/PNG receipt photo (5 MB, 25 MP) to a saved transaction. Decode and re-encode pixels; authenticated, session-bound download links expire after five minutes. Editors can remove a photo explicitly. Workbook exports list receipts, individual downloads export images, and database backups include the normalized bytes. Hosted storage, malware scanning policy and distribution remain release decisions.
- [x] Local web preview: save a private income/expense draft with Save draft or Ctrl/Cmd+S, resume it from another capture form, and autosave resumed edits. Posting consumes the versioned draft atomically and is safe to retry. Existing repeat, recent categories and save-and-add remain available. Native offline recovery belongs to M9.

Acceptance: rules are deterministic; previews equal committed results for unchanged input; manual overrides survive resync. Split amounts balance exactly, receipts are inaccessible across workspaces, and undo never overwrites a newer edit.

### M5 — Budgets and savings backed by real money

Local preview started: opt-in monthly category allocations with an explicit starting month, rollover of positive or negative remainders, and recomputation from posted category portions. Starting amounts can be copied from existing limits. Planning also supports reserving and releasing confirmed cash for a savings goal, checks the available balance across all goals, and labels earlier manually tracked progress separately. Exports and encrypted backup coverage include the new planning records. Payday budgets support weekly, biweekly and irregular periods with a spending limit and separate expected/posted income. Annual funds use a goal target, an explicit due date, actual reservations and any separate opening savings explicitly confirmed by a member. The monthly estimate includes the current and due months, rounded up to the cent. Renew the due date explicitly after reviewing each bill. Both schedules are included in exports and backup coverage. In local Activity, open an income entry's Refund link to assign a posted credit to an earlier purchase. Partial refunds can cover several original categories. Budgets recognize the credit on its posting date, including across months, and unlinking restores the original budget calculation. Cash balances and ledger history retain both original entries. Hosted release validation remains pending.

- [x] Local preview: effective-dated category allocations and rollover, with existing limits offered as a starting amount. Move available budget between two planned categories for one month. The monthly history and workbook export record both categories, the amount, author, time and optional note.
- [x] Local preview: support monthly, payday, annual/sinking-fund, and irregular-income planning. Separate expected income from confirmed money available to allocate.
- [x] Local preview: record goal reservations and releases as explicit allocations against eligible posted account balances. Do not manufacture cash when allocating to a goal.
- [x] Local preview: preserve the original manual goal entry. Count reserved cash and only the portion explicitly confirmed as separate savings for that goal. Versioned reviews can be revised and exported. Account reservations still enforce available cash across goals.
- [x] Local preview: explain overspending, rollover, refunds, and changes to past periods. Budget moves are allocations, not bank transfers or expenses.

Acceptance: month/year boundaries, leap years, irregular pay dates, overspending, refunds, and late edits recalculate deterministically. Moving allocations changes no account balances. Goal contributions and withdrawals cannot double-count cash.

### M6 — Forecasts and a decision-focused dashboard

- [x] Local preview: Planning shows daily closing balances for a single account or the household through the next recorded payday or 30/60/90 days. Opening balances use dated ledger entries through today. The breakdown distinguishes future ledger entries, transfers, recurring entries and bill estimates, and flags exact possible overlaps.
- [x] Local preview: model confirmed cash, dated income and bills, transfers, installment payments, reservations, everyday spending and buffers. Base can optionally project the uncovered portion of a saved income target at period end. Named card transfers can cover one matching installment occurrence. Conflicting ledger records remain visible for review.
- [x] Local preview: save base and conservative daily spending and cash buffers per active cash account, separately from transactions. Conservative inherits base floors and excludes unmatched scheduled income.
- [x] Local preview: show active accounts without dated activity, transfers or completed statement coverage in the last 30 days. Flag plausible monthly bills with three consecutive comparable payments and no corresponding named schedule or nearby ledger expense. Review hints include dates and links to the account, and do not post entries or alter projections.
- [x] Local preview: derive an estimated spendable amount from the minimum projected unreserved cash across the selected horizon, accounting for commitments and buffer. Explain inputs and exclusions; display a shortfall when negative, not a misleading positive allowance.
- [x] Local preview: Overview groups current position and direct account access, an attention inbox, a 30-day household cash outlook, and current budget and goal progress. The activity period controls recent transactions and charts independently of the outlook.
- [x] Local preview: explain opening, closing, lowest, cash-only and spendable balances from their forecast snapshot. Link dated changes to exact ledger entries, transfers, schedules and scenario settings, and show goal holds and buffers separately.

Acceptance: hand-calculated fixtures match the engine; account transfers cancel in household totals; scheduled and already-posted payments are counted once. Every estimate has a horizon, last-calculated time, and visible assumptions. Incomplete data produces an explicit limitation.

### M7 — Household coordination and privacy

- [x] Define the [owner/member/viewer and personal/shared permission matrix](docs/household-access.md) before implementation. Local preview: Activity → History & access distinguishes the recorded creator, tracker and current access on existing shared entries. Unknown creators remain unknown.
- [x] Local preview: restrict pending invitation addresses to the current owner on web and mobile. Recheck membership for shared transaction history, edits and deletions; a removed tracker selection cannot redirect an open form to another ledger.
- [x] Local storage and privacy rehearsal: explicitly link one fresh personal ledger to its household and person; accounts and entries inherit that ledger's audience, independently of who entered them. Never convert an existing ledger on the user's behalf.
- [x] Exercise current shared/private boundaries with synthetic members: Activity (including search and counts), balances and Overview, forecasts, mobile bootstrap, edit history, receipt downloads, and workbook exports including historical statement/import evidence. Block personal reminders and digests until delivery is explicitly configured.
- [x] Local preview: bind signed-in forms and requests to the session, tracker and role. Recheck access on resume and while the app is open. Rehearse stale writes and revocation with independent web and mobile sessions. Accounts → Open my private accounts starts a new, empty personal tracker in the embedded preview.
- [x] Local web preview: a private account owner can review a read-only copy for one named household member, include receipt photos by choice, confirm, update or withdraw the copy. A changed preview requires fresh approval. The recipient opens the approved edition from household Accounts.
- [x] Existing accounts retain their original visibility. Sharing does not move the source account or add entries to household totals. Removing either member retires the grant.
- [x] Local web preview: settle the reviewed IOUs between two members against one posted payment, record one new payment, or mark the balance paid outside the tracker. Transfers between tracked accounts preserve household cash-flow totals. Reopening releases the link and retains the payment.
- [ ] Verify background/resume on a physical phone and coordinate the compatible native and server release. The protected Vercel preview rejects old web and mobile sessions after revocation.
- [x] Verify privacy in queries, totals, search, exports, attachments, notification audiences, forecasts and mobile APIs. The [hosted M7 rehearsal](docs/m7-hosted-rehearsal.md) covers two household trackers, a private ledger, named receipt sharing and removal. Regression tests also cover malformed historical links.
- [x] Local web preview: Activity → transaction menu → Comments. Members with editing access can post. Viewers can read. Private account report recipients cannot open the original conversation. Active comments protect the entry against accidental deletion.
- [x] Local web preview: Planning opens with a weekly household check-in. It nets open reimbursements between each pair of people, shows the next seven days of household bill schedules, and lists remaining savings targets by deadline. Members and viewers can follow the figures back to their source.
- [x] Local implementation: in web and mobile Settings, each household member or viewer can opt into email or push separately for upcoming recurring items, posted entries, budget alerts, and monthly digests. Delivery checks current membership and the selected channel. Removing membership clears its choices.
- [x] Local implementation: each person can set invitation delivery across all households and comment-mention delivery separately in each household. Both support independent email and push opt-ins. Comment authors choose recipients explicitly. Delivery rechecks access and preferences.
- [ ] Verify invitation and mention delivery with a test email account and a physical phone, including notification taps and opting out, before hosted release.

Acceptance: role/ownership tests cover every surface and changes in membership. Removing access revokes future reads and clears client caches. Two household members can review a week without changing each other's private entries.

### M8 — Credit cards, loans, and multicurrency

Implementation verified in the isolated web preview. Debt and multicurrency have separate release modes and additive migrations. Production activation remains separate. See [M8 implementation and acceptance](docs/m8-debt-and-currencies.md).

**M8a: debt**

- [x] Define liability balances, statement cycles, due dates, minimum payments, interest/fee entries, and payment allocation. Existing account balances require reviewed mapping, not automatic sign inversion.
- [x] Credit-card purchases affect spending once; repayments move money and reduce liabilities; interest/fees affect spending separately.
- [x] Add loan terms and reproducible payoff scenarios with displayed rate, compounding assumptions, fees, and variable-rate limitations. A forecast is not the lender's actual amortization statement.
- [x] Distinguish liquid cash, debt, and net worth across dashboard and reports; credit availability is never cash income.

**M8b: currencies**

- [x] Add explicit account currency, transaction original amount/currency, rate/source/time, and reporting currency. Require the owner to confirm currency for existing accounts; display settings do not prove historical denomination.
- [x] Record both sides and fees of cross-currency transfers. Use decimal arithmetic and currency-specific precision, with a documented rounding-residual policy.
- [x] Preserve original records and booked rates. Separate historical transaction conversion from current balance valuation; refreshes must not rewrite history.
- [x] Missing rates produce incomplete totals or separate currency totals, never a guessed conversion. Make budget/forecast currency assumptions explicit.

Acceptance: CAD/USD and a zero-decimal currency fixture reconcile independently; repayments/refunds are not double-counted; stored historical values remain stable after rate updates. Export and restore retain both original and reporting data.

### M9 — Native quality and offline drafts

- [x] Maintain one backend calculation/permission contract; use shared DTOs and pure financial logic where practical without a repository-wide rewrite.
- [x] Bring stable web workflows to native with a feature parity matrix. Preserve platform-appropriate navigation, accessible text scaling, safe areas, and reachability.
- [x] Add biometric local unlock with device-auth fallback and secure session handling. Local app locking is not a replacement for server authentication.
- [x] Implement encrypted, user/workspace-scoped offline drafts first. Label pending saves clearly. Use server idempotency and version checks for retries; conflicting edits require resolution rather than last-write-wins.
- [x] Never run bank synchronization offline. On logout/workspace switch, isolate or clear cached data and prevent queued drafts from being sent to the wrong workspace.
- [x] Add deep links and privacy-aware notification content; obtain OS notification permission through normal user flows.
- [ ] Test real Android/iPhone installs, process death, network loss after successful save, expired sessions, background/resume, push delivery, and accessibility.

See the [native parity matrix and physical acceptance procedure](docs/m9-native-acceptance.md). Device installation, OS unlock, push delivery, and assistive-technology results remain open on both platforms.

Acceptance: airplane-mode capture survives restart; reconnect creates one entry even if the first response was lost; another user's login cannot see drafts. Actual-device receipts distinguish simulator success from device acceptance.

External gate: verify current Apple/Expo signing access before promising an installable IPA. The planned EAS internal iOS route requires valid provisioning for the receiving device. Android internal builds and web work can proceed independently.

### M10 — Onboarding, performance, and pilot acceptance

Local engineering and the pilot operating guide are in [Pilot operations](docs/pilot-operations.md). Participant outcomes, deployed performance, actual costs, and wider-release review require external evidence.

- [x] Provide resumable setup: household currency/timezone, accounts, opening-balance date, existing-history preview, recurring bills, first reconciliation, and optional partner invite. Skip bank setup when unavailable.
- [x] Keep example data in a separate demo; never seed examples into a real household. Reconcile opening balances with the import cutoff so historical transactions are not counted twice.
- [x] Add contextual empty states, labelled controls, keyboard and accessibility-tree checks, plain-language error recovery, and compact/comfortable density without shrinking mobile targets.
- [ ] Observe assistive-technology use with a participant on their device.
- [x] Optimize measured bottlenecks: scoped query indexes, server pagination, aggregates, deferred modules, appropriate cache invalidation, and bounded exports. Never cache authenticated financial responses across users/workspaces.
- [x] Exercise large workspaces and concurrent usage with synthetic data, including recurrence and bank jobs running during edits.
- [ ] Invite a small consenting pilot only after permission/recovery gates pass. Observe setup, manual capture, import review, reconciliation, forecast explanation, and weekly household review.
- [x] Add a feedback route, issue severity/response process, feature limitation page, privacy/retention documentation, and export/account closure workflows.
- [ ] Obtain jurisdiction-appropriate review before a wider public launch.
- [x] Provide an anonymous pilot scorecard for task outcomes, browser timings, retention, costs and support effort.
- [ ] Measure provider/hosting/storage/notification cost per active household and support effort before choosing pricing or scaling. Do not purchase plans based on estimates alone.

Acceptance: pilot users finish core tasks with minimal assistance, no unresolved critical financial/privacy defects, and evidence against the quality targets below. Record failures and fix them before broader release.

## 6. Data architecture and migration map

The following are proposed entities, not finalized table names or migration numbers. Add only what each milestone needs.

| Domain | Additive records | Compatibility rule |
| --- | --- | --- |
| Integrity | Mutation requests, entity versions, financial audit events | Existing web/mobile contracts remain usable during rollout. |
| Recovery | Backup manifests, destination metadata, verification results | No plaintext keys or financial data in status records. |
| Reconciliation | Statement sessions, entry revision links, import batches/rows | Existing ledger untouched until a reviewed financial action. |
| Banks | Connections, selected accounts, staged feed, import links, jobs, reviews | Follow detailed bank plan; no cascade loss of provenance. |
| Organization | Merchant aliases, rule versions, allocation lines, receipt metadata | Parent movement counts once; attachment objects included in recovery. |
| Planning | Budget periods/allocations, goal reservations/contributions, forecast assumptions | Plans and projections do not themselves post ledger transactions. |
| Household | Ownership/access records, comments, reimbursement links | Server-enforced visibility; preserve legacy sharing defaults. |
| Debt/FX | Liability terms/statements, currency metadata, rates, conversion records | Historical amounts remain original; ambiguous migrations require review. |
| Native | Device/session records if needed; local encrypted draft outbox | Drafts scoped to authenticated user/workspace with idempotent upload. |

Use reviewed migrations with resumable, explicitly scoped backfills. Large indexes or constraint validation need lock/time estimates. Never modify an already-applied migration; add a new one. Extend backup, restore ordering, exports, deletion/retention, and permissions in the same feature slice as each new entity.

## 7. Verification and release procedure

For every milestone, attach a receipt with commit, schema version, environment, commands/results, screenshots where useful, migration behavior, observed limits, and rollback instructions. Existing repository commands are `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build:preview`; add dedicated checks only as implemented.

1. Develop on synthetic fixtures. Check installed framework/provider documentation and inspect existing user changes before editing.
2. Test financial math, authorization, concurrency, failure recovery, and relevant UI flows. PGlite tests do not replace tests against the actual production driver in disposable staging.
3. Rehearse additive migration and restoration in isolation, including new attachments and encrypted token keys where applicable.
4. Before production migration, take a fresh verified backup and financial baseline. Account for concurrent legitimate writes with a controlled write window or consistent snapshot/audit boundary; do not falsely label normal new transactions as corruption.
5. Deploy backward-compatible code with the feature disabled; apply the reviewed migration under a migration lock and timeout. Compare preexisting rows, references, and balances at the same boundary.
6. Enable for an allowlisted household. Inspect exact commit/deployment, logs with redaction, permissions, outputs, and real-world acceptance. Production checks should avoid creating artificial money movements.
7. Broaden only after acceptance. Stop/disable on unexplained balance drift, cross-workspace access, duplicated postings, or unrecoverable backup failures.
8. On failure, disable feature/jobs and use compatible code rollback. Preserve additive data; investigate and correct individually. A recovery that requires database restoration uses a new database plus reconciliation of writes after the snapshot.

Minimum critical test scenarios: duplicate submit, stale tab, concurrent household edit, cron/import race, response lost after commit, partial file failure, bank pagination restart, delayed correction, account archive/delete/undo, refund/transfer matching, month/DST boundaries, permission revocation, missing FX rate, split rounding, and offline replay.

## 8. Quality targets and evidence

These are proposed acceptance targets, not current measured achievements.

| Area | Target | Evidence |
| --- | --- | --- |
| Ledger correctness | No unexplained balance drift or duplicate movement in release scenarios | Independent expected totals, concurrency/fault tests, pilot reconciliation |
| Setup | At least 4 of first 5 observed households complete core manual setup without assistance | Recorded task outcomes; small sample, not statistical proof |
| Capture | Median under 10 seconds for a familiar manual expense | Timed task with defined starting screen; include failures |
| Web experience | p75 LCP <= 2.5s, INP <= 200ms, CLS <= 0.1, segmented mobile/desktop | Privacy-safe real-user measurements; lab results labeled separately |
| Activity performance | Proposed p95 under 1s for a filtered page at 100k entries on an agreed staging profile | Full request timing, query plan, payload; report cold starts separately |
| Recovery | Initial RPO <= 24h and clean-environment RTO <= 4h; tighten before broader scale | Independent backup schedule and timed recovery drill; local-only setup cannot guarantee this |
| Bank reliability | No lost committed updates or duplicate postings in replay/failure tests | Durable job/cursor receipts; provider freshness reported separately |
| Accessibility | Core tasks usable with keyboard, screen reader, reduced motion, and text scaling | Manual task verification plus automated checks; no blanket compliance claim |
| Product value | Track four-week household retention, review time, and unresolved discrepancies | Define active household as completing a core task; establish pilot baseline before setting retention promises |

Do not report targets as results. Capture regressions against M0 and retain failed cases as meaningful regression tests.

## 9. Decisions and external dependencies

| Decision | Default until resolved | Needed by |
| --- | --- | --- |
| Bank account/access and charges | Synthetic/local work only; no paid activation | M3 Sandbox/live milestones |
| Independent backup destination and recovery custodian | Preserve local backup; build/test adapter locally | M1 independent recovery release |
| Notification destination/provider | In-app status and local test sink | Real operational alerts/digests |
| Receipt object storage and retention | Private local fixture storage | M4 deployed attachments |
| Household private/shared expectations | Preserve current sharing; no silent visibility changes | M7 UX/schema release |
| First non-CAD currencies and rate source | CAD production; synthetic FX fixtures | M8b live activation |
| Apple signing and physical devices | Continue web/Android and simulator verification | M9 iPhone distribution |
| Pilot audience, telemetry consent, support owner | Existing household only | External pilot |

Request decisions when their implementation is concrete and reviewable. Do not block unrelated local work or request all credentials up front. Store secrets using ignored local configuration or the provider secret manager, never chat or Git.

## 10. First implementation batch and completion tracking

Start with M0 and the smallest M1 slice, not a full dashboard rewrite:

1. Inventory financial mutation entry points across web/mobile/imports/cron and create the capability matrix.
2. Define balance/refund/transfer/date invariants and independent synthetic expected results.
3. Add privacy-safe performance/error baselines and recovery status inspection.
4. Implement one idempotent, audited transaction-create path end to end; test retries/concurrency on local and production-equivalent staging drivers.
5. Extend incrementally to edit/delete/undo/transfers/recurring posting, then deliver M2 reconciliation.

Maintain checkboxes in this document as work proceeds. For each finished milestone, link a dated receipt under `docs/` and distinguish local, staging, device, and production results. Do not mark a milestone complete while its external acceptance remains pending.

Re-estimate effort after M0 and after the first Sandbox/device vertical slice. The full roadmap is a substantial multi-release product effort; a fixed calendar promise before provider access, accounting decisions, and device testing would be misleading. Ship complete slices and review value after each, rather than rushing every item into one deployment.

## 11. References checked for this plan

- [Plaid Transactions](https://plaid.com/docs/transactions/) — provider integration and update model; exact institution access, freshness, and charges still require account-specific verification.
- [Web Vitals](https://web.dev/articles/vitals) — p75 loading, interaction, and layout-stability targets used above.
- [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/) — platform signing/provisioning and installation behavior; recheck actual project access before building.

References checked 31 October 2026. This plan makes no changes to live financial data and does not imply any proposed capability has shipped.

## Next phase — M11 through M15

### Who we want to serve first

Start with Canadian couples who manage joint bills and keep some accounts private. Ask each couple one question. **In five minutes together, can we see what changed, agree what needs attention, and tell what we can spend before payday?** Five minutes is a proposed target. A missed bill, an unexplained balance, or a partner seeing a private transaction matters more than finishing quickly.

The November 4 release at `eb66317` passed 317 tests. The release check compared balances, transactions, transfers, and financial history against restored encrypted backups. That gives us a sound starting point for releases. We have no observed household retention, support-cost baseline, or physical-phone acceptance yet.

Competitors give us a useful bar. YNAB already helps people allocate available money toward upcoming needs. Monarch already lets people choose which transactions need review. Our hypothesis is that couples will return for a short shared review that explains each number while respecting what each partner keeps private. Measure that before funding a wider launch. [YNAB planning and targets](https://support.ynab.com/en_us/getting-started-ynab-basics-and-key-terms-BJCaIHaTZe) · [Monarch transaction review](https://help.monarch.com/hc/en-us/articles/28953573066260-Transactions-and-Rules-Tips-Tricks)

### M11 — Find where households get stuck

**First week of work.** The owner names a pilot facilitator and backup contact. The engineer rehearses the six [existing pilot tasks](docs/pilot-operations.md) on an isolated hosted tracker with a synthetic statement. Before external enrollment, rotate the database credential previously shared in chat, update the deployment and backup task together, verify a new restore, and record who can access pilot feedback. Keep the existing encrypted-on-computer backup policy. Record what happens if the computer is off or lost.

With consent, observe up to five households doing setup, capture, import, reconciliation, forecast, and weekly review. Record unassisted, assisted, or unfinished for each attempt, the step that caused difficulty, and elapsed time. Keep account details out of the research record. Use the existing pilot scorecard. Follow the original cohort for four weeks.

**Decision.** Aim for at least four of the first five households finishing setup unassisted, a median familiar-expense entry under ten seconds, and zero unexplained balance or privacy incidents. Show the count of failed attempts alongside the median. Rank the two largest obstacles by households affected and consequence. If setup or reconciliation repeatedly fails, fix it and repeat before adding features. With no available participants, label the run a rehearsal and leave product acceptance open.

**November 4 engineering rehearsal.** The [facilitator worksheet and practice statement](docs/m11-household-observation.md) are ready. The six-task exercise passed in memory and against a dedicated synthetic Neon database. The practice ledger closed at C$90.00 after two expenses and forecast a C$70.00 low after tomorrow's bill. A signed-in local web server using a restricted role on that database served Setup, Imports and Statement review. The mobile balance and household scope matched. A new encrypted production snapshot restored 415 rows in isolation. The application type check and 318 tests passed.

**Fieldwork remains open.** Observed households 0/5. Unassisted setup, capture speed, incidents in participant sessions, recurring obstacles and week-four returns are unmeasured. The remote Vercel web preview, coordinated credential replacement, staffing, feedback access and consent must be confirmed before enrollment. Use the original five for the follow-up.

### M12 — Make the weekly review worth returning for

**First product change, subject to M11 findings.** Extend the weekly household check-in and Attention inbox. Start with the previous review date, surface only items that changed or still need a decision, and link directly to the source. Each partner can open a bill change, review an outstanding reimbursement, or defer an item until the next review. Finishing gives them a short receipt of what they reviewed and what remains. Review status is separate from payments and posted transactions.

Prototype the flow with synthetic data before saving review state. Test private accounts, changed sharing permissions, repeated clicks, a second partner reviewing concurrently, and a bill corrected after review. A shared summary must also protect private names, amounts, counts, and inferred totals.

**Decision.** With a seeded discrepancy, at least four of five households should finish unassisted within five minutes, identify the discrepancy, and explain their next action. At week four, report how many eligible households returned and completed the review voluntarily. A preliminary continuation threshold is three of five. Use that result to decide whether to recruit a second cohort.

**November 5 implementation.** Planning now has a resumable weekly review linked from the Overview Attention inbox. Each member can review, defer for seven household-calendar days, or undo a choice on upcoming bills, outstanding reimbursements and savings goals. Changed source facts reopen an item. The passage of a day alone does not cancel a deferral. Bill amounts retain their account's reviewed currency, with explicit currency codes. Finishing saves a retry-safe receipt with open items preserved. The latest review date and source links make it possible to resume without rechecking unchanged items. Choices are per member so one partner cannot silently clear the other's review.

The additive `0032_weekly_reviews` migration stores review progress and receipts separately from the ledger. Receipts keep source identifiers and fingerprints rather than historical names or amounts, and resolve visible content again on every read. Personal accounts, including shared personal-account reports, do not enter this household summary. Removed membership clears that member's review records. Older schemas retain the existing check-in until the migration is applied. Backups cover the new records and restore rehearsal includes schemas 28 through 32.

**Local verification.** The full 47-file suite passes 325 tests, including seven review integration tests. Type checking, lint and an isolated production build pass. The encrypted backup command restores schemas 28 through 32 and preserves the existing financial rows across migrations. Browser checks cover entry from Overview, reviewed/deferred choices, finish receipt, reopening, corrected bill detection without a page reload, keyboard undo and the goal source link. A 390-pixel viewport has no horizontal page overflow. The synthetic account stays at C$92.50 while its bill estimate changes from C$20 to C$27 and C$28. Initial build attempts encountered a sandbox filesystem denial and a Webpack hash error; a clean source copy with production connections disabled builds successfully. The local rehearsal is separate from the live ledger and the five-household acceptance exercise.

**Acceptance remains open.** This is local engineering evidence, with no production deployment or live database change. Use the [M12 exercise](docs/m11-household-observation.md#m12-weekly-review-exercise) to collect the five-household result. Human completion time, discrepancy detection, next-action comprehension and voluntary week-four return remain unmeasured. Do not treat an automated rehearsal as evidence of habit or completion speed.

### M13 — Test a purchase before committing money

**Build if households use the review but still leave to work out a spending decision.** Add one temporary question to the existing forecast, such as “What if we spend C$300 on Friday?” Reuse the existing forecast, bills, goal reservations, and buffer. Show the lowest projected balance, the date, the difference from the original plan, and the assumption most likely to change the result. Mark missing account evidence or rates explicitly. Close the scenario to discard it.

Add a “what actually changed?” comparison for the reviewed period. Start with dated bills and explained differences such as an early payment or an unplanned expense. Distinguish a projection error from a later ledger correction. Save a forecast baseline only when a member explicitly chooses to, with the same visibility as its source.

**Decision.** Cover pay delays, refunds, transfers, missing rates, and incomplete accounts with independent examples. Require exact-cent agreement for supported scenarios, zero posted entries from simulations, and four of five participants correctly explaining why the lowest balance changed. If people already make the decision comfortably using today's forecast, defer this milestone.

**November 5 implementation.** The Balance forecast now contains a compact “Can we afford this?” panel. Choose one active cash account, an amount and a date within the selected forecast period. The temporary scenario reuses dated entries, scheduled bills, the daily spending estimate, goal reservations and the cash buffer. It shows the original and proposed lowest balance, their dates, the difference, and cash remaining above protected funds. A sensitivity example moves the largest incoming amount seven days later; when none exists, it explains the effect of extra daily spending. Missing account evidence or unconfirmed assumptions prevent a confident answer. Closing the panel discards the purchase, and calculations never create transactions.

Members can explicitly save the original forecast, excluding the hypothetical purchase. “What actually changed?” compares that baseline with current recorded activity through today or the saved period's end. It separates earlier-history and later-ledger corrections from changed amounts, posting dates, additional activity and the everyday allowance. Only unique schedule/entry matches within three days are paired; duplicate matches and linked refunds remain separate. Every displayed difference reconciles exactly to the change in recorded balance. A missing match is not described as an unpaid bill.

The additive `0033_forecast_baselines` table holds member-scoped evidence, identifiers and fingerprints, without historical transaction names, notes or category labels. Every read rechecks membership, account and source visibility. Repeated saves with the same request ID cannot create a second baseline; changed evidence requires recalculation. Existing databases can calculate temporary scenarios before the migration, while saving stays unavailable. Encrypted backups include baseline records, with migration/restore rehearsals through schema 33. This release supports cash accounts in the tracker's reporting currency; foreign-denomination accounts and accounts affected by cross-currency transfers explicitly require a currency-aware forecast rather than displaying unreliable converted totals.

**Local verification.** Eight M13 integration tests cover exact cents, pre-deposit lows, delayed incoming payments, reservations, missing evidence/rates, refunds, transfers, ambiguous matching, ledger corrections, retries and permission changes. The full 48-file suite passes 333 tests; type checking, lint and an isolated production build also pass. The final suite used one worker after an earlier concurrent run hit memory exhaustion and sandbox file-read denials. Encrypted backup/restore passes for schemas 28–33, preserving the existing financial rows. Browser checks in a separate synthetic household confirm a C$300 purchase leaves a C$575 low and C$275 above protected funds, while C$800 produces a C$225 protected-cash shortfall. The saved C$1,000 projection reconciles to C$875 through an early C$100 bill and C$25 additional expense. A saved current plan still compares at C$875 with zero difference after the purchase scenario is discarded. Date changes, close/reopen, saved-plan persistence and a 390-pixel layout are checked. No live migration, deployment or live ledger change is part of this implementation.

**Acceptance remains open.** The engineering implementation is complete locally. The [M13 household exercise](docs/m11-household-observation.md#m13-purchase-decision-exercise) is ready, but the four-of-five comprehension criterion is unmeasured. M11 observed households remain 0/5. The strongest reason to defer broader rollout is that household need and comprehension have not yet been demonstrated; a passing calculation does not establish that a purchase is safe or that this feature helps people decide.

### M14 — Prove the phone experience and recovery

Run alongside the pilot as devices become available. Prioritize a phone-sized web path from Add to saved entry, account history, and weekly review. Test keyboard navigation, large text, screen readers, a slow connection, and a retry after a lost response. Measure real page load and interaction for consenting participants separately from database benchmarks. Use the performance targets in section 8.

Complete the existing [native acceptance checklist](docs/m9-native-acceptance.md) on physical Android and iPhone hardware before distributing the respective build. Rehearse an offline draft, force quit, reconnect, revocation, and notification privacy. Time a clean restore with the protected key and backups. Target a recoverable backup under 24 hours old and recovery within four hours. Record failures and dependencies, including iOS signing and the availability of the backup computer.

**Decision.** Ship each platform independently when its critical tasks pass. A retried transaction must produce exactly one posting. A removed member must lose access. A simulator or a mobile-sized browser is insufficient evidence for native distribution.

### M15 — Decide whether to expand or connect banks

After the four-week cohort, the owner reviews repeat usage, unresolved discrepancies, support minutes, actual monthly costs per active household, and the reason each household returned or stopped. Separate participant interest, willingness to pay, and actual payment. If a larger pilot is justified, try one recruitment channel and count invitations, activations, four-week returns, and operator hours. Use those observations to decide whether a paid offering could cover delivery and support.

Real-bank connectivity remains an optional branch requiring a new owner decision. Pursue it if repeated manual import is a leading reason households stop. Verify current Canadian Transactions coverage for the exact RBC and TD connections and account types, obtain provider access and actual pricing, set a spend cap, and agree on consent, deletion, and incident handling. Start with one consenting household in observation-only mode. Exercise disconnect, replay, and pending-to-posted changes. Move to explicit Match existing / Import / Ignore only after the history reconciles without duplicate postings. Manual file review stays available. [Plaid institution coverage](https://plaid.com/docs/institutions/) · [Plaid transaction updates](https://plaid.com/docs/transactions/sync-migration/)

### Sequence and protection of the live ledger

Start M11 immediately. Prototype M12 once the first observed sessions identify friction. M13 competes with fixing the biggest observed obstacle. M14 can proceed independently when devices are available. Decide M15 after four weeks of observations. The order can change as evidence arrives.

For every production data change, take a fresh encrypted backup, restore it separately, rehearse the migration, and compare original financial rows and per-account balances at the same write boundary. Verify the signed-in workflow on the deployed commit. On unexplained drift or a privacy failure, stop rollout, preserve newer activity, and follow the recovery procedure in section 7. Keep autonomous ledger edits, investment trading, and a broad visual redesign outside this phase.
