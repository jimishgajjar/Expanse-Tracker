# Finance Tracker implementation roadmap

Prepared: 31 October 2026, America/Toronto.
Status: proposed implementation backlog; this document does not authorize paid services, activate bank access, change the database, or claim completed implementation.

Implementation started 31 October 2026: M0 capability inventory/synthetic query baseline and the M1 manual-create integrity slice. See [financial-foundation.md](docs/financial-foundation.md) for scope, verification and remaining gates. Full milestones remain incomplete until their acceptance criteria pass.

M2 started 31 October 2026: saved statement reviews, exact-balance completion and detection of subsequent ledger changes. This is the reconciliation slice; reviewed CSV/Excel staging and durable import provenance were implemented locally on 3 November 2026 (see [reviewed-file-imports.md](docs/reviewed-file-imports.md)). Hosted concurrency has since been verified with synthetic data; production rollout remains pending. See [statement-reviews.md](docs/statement-reviews.md). The new feature is disabled by default outside the isolated preview.

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

Third implementation part (3 November 2026): investigate changes entry by entry and record a verified missing transaction. No additional database migration. Hosted multi-session rehearsal passed on 3 November 2026 with synthetic data (see [hosted rehearsal](docs/m2-hosted-rehearsal.md)). Production backup, preservation checks and rollout remain outstanding; M3 provider work is separate.

Acceptance: a fixture with a missing fee, duplicate purchase, transfer, and refund reconciles only after the specific issues are resolved. Completed periods flag subsequent changes. Partial file failures have explicit row outcomes and exports preserve provenance.

### M3 — Production bank connectivity

Implement the detailed bank plan rather than copying the demo snapshot store into production.

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

- [ ] Add merchant aliases and deterministic category/tag rules with priority, conditions, version history, dry-run preview, and conflict explanations.
- [ ] Default rules to suggestions or changes on unreviewed entries. Applying a rule to existing reviewed history requires an explicit preview and audited batch action.
- [ ] Support splitting one purchase into category allocations whose sum equals the original amount exactly. Account balance counts the parent once; reports/budgets use allocations. Shared-expense IOUs remain a separate concept.
- [ ] Add bulk category/tag changes with bounded batches, stale-version checks, visible outcomes, and conflict-aware undo.
- [ ] Add private receipt attachments with size/type limits, validation/scanning, signed access, retention, export, and backup coverage. OCR is optional and produces editable suggestions, never automatic ledger writes.
- [ ] Preserve quick entry, repeat, recent categories, and save-and-add. Add safe draft recovery and consistent keyboard/mobile shortcuts.

Acceptance: rules are deterministic; previews equal committed results for unchanged input; manual overrides survive resync. Split amounts balance exactly, receipts are inaccessible across workspaces, and undo never overwrites a newer edit.

### M5 — Budgets and savings backed by real money

- [ ] Add effective-dated budget plans/periods, rollover policy, category allocations, and adjustments. Migrate current limits as an explicit starting configuration without inventing historical budget periods.
- [ ] Support monthly, payday, annual/sinking-fund, and irregular-income planning. Separate expected income from confirmed money available to allocate.
- [ ] Add goal contribution/reservation records linked to eligible ledger movements or explicitly identified cash allocations. Do not manufacture cash when allocating to a goal.
- [ ] Preserve existing manual goal progress as a labeled opening progress value until reviewed; prevent allocating the same funds to multiple goals.
- [ ] Explain overspending, rollover, refunds, and changes to past periods. Budget moves are allocations, not bank transfers or expenses.

Acceptance: month/year boundaries, leap years, irregular pay dates, overspending, refunds, and late edits recalculate deterministically. Moving allocations changes no account balances. Goal contributions and withdrawals cannot double-count cash.

### M6 — Forecasts and a decision-focused dashboard

- [ ] Implement a deterministic dated cash-flow engine for next payday and 30/60/90 days, per account and household.
- [ ] Model confirmed cash, expected income, recurring bills, planned transfers, debt payments, savings reservations, essential variable spending, and a user-selected buffer without counting overlapping commitments twice.
- [ ] Store user scenario assumptions separately from transactions. Mark estimates, stale accounts, missing bills, and uncertain income; allow conservative/base scenarios.
- [ ] Derive an estimated spendable amount from the minimum projected unreserved cash across the selected horizon, accounting for commitments and buffer. Explain inputs and exclusions; display a shortfall when negative, not a misleading positive allowance.
- [ ] Replace competing dashboard widgets with four sections: current position; attention inbox; upcoming/projected money; budget/goal progress. Keep account access and Add transaction immediately reachable, with charts available below.
- [ ] Add an explain-this-number breakdown leading to the source transactions, plans, and dates. Do not present an estimate as a guarantee or personalized investment advice.

Acceptance: hand-calculated fixtures match the engine; account transfers cancel in household totals; scheduled and already-posted payments are counted once. Every estimate has a horizon, last-calculated time, and visible assumptions. Incomplete data produces an explicit limitation.

### M7 — Household coordination and privacy

- [ ] Separate who entered a transaction from who owns it and who can view it. Write an owner/member/viewer and personal/shared permission matrix before implementation.
- [ ] Preserve current workspace visibility by default; do not retroactively hide or expose historical entries. Personal account sharing requires an explicit audience change.
- [ ] Apply visibility in queries, totals, search, exports, attachments, notifications, forecasts, and mobile APIs, not just UI filters. Avoid leaking private totals through household aggregates.
- [ ] Add transaction comments, reimbursement links/status, and a compact weekly check-in of unresolved items, bills, and goals.
- [ ] Settle an IOU using an existing payment link or an explicitly created payment; never record both by accident. Invites, mentions, and digests require deliberate recipient/channel settings.

Acceptance: role/ownership tests cover every surface and changes in membership. Removing access revokes future reads and clears client caches. Two household members can review a week without changing each other's private entries.

### M8 — Credit cards, loans, and multicurrency

Deliver these as separate subreleases; do not mix liability semantics with currency migration.

**M8a: debt**

- [ ] Define liability balances, statement cycles, due dates, minimum payments, interest/fee entries, and payment allocation. Existing account balances require reviewed mapping, not automatic sign inversion.
- [ ] Credit-card purchases affect spending once; repayments move money and reduce liabilities; interest/fees affect spending separately.
- [ ] Add loan terms and reproducible payoff scenarios with displayed rate, compounding assumptions, fees, and variable-rate limitations. A forecast is not the lender's actual amortization statement.
- [ ] Distinguish liquid cash, debt, and net worth across dashboard and reports; credit availability is never cash income.

**M8b: currencies**

- [ ] Add explicit account currency, transaction original amount/currency, rate/source/time, and reporting currency. Require the owner to confirm currency for existing accounts; display settings do not prove historical denomination.
- [ ] Record both sides and fees of cross-currency transfers. Use decimal arithmetic and currency-specific precision, with a documented rounding-residual policy.
- [ ] Preserve original records and booked rates. Separate historical transaction conversion from current balance valuation; refreshes must not rewrite history.
- [ ] Missing rates produce incomplete totals or separate currency totals, never a guessed conversion. Make budget/forecast currency assumptions explicit.

Acceptance: CAD/USD and a zero-decimal currency fixture reconcile independently; repayments/refunds are not double-counted; stored historical values remain stable after rate updates. Export and restore retain both original and reporting data.

### M9 — Native quality and offline drafts

- [ ] Maintain one backend calculation/permission contract; use shared DTOs and pure financial logic where practical without a repository-wide rewrite.
- [ ] Bring stable web workflows to native with a feature parity matrix. Preserve platform-appropriate navigation, accessible text scaling, safe areas, and reachability.
- [ ] Add biometric local unlock with device-auth fallback and secure session handling. Local app locking is not a replacement for server authentication.
- [ ] Implement encrypted, user/workspace-scoped offline drafts first. Label pending saves clearly. Use server idempotency and version checks for retries; conflicting edits require resolution rather than last-write-wins.
- [ ] Never run bank synchronization offline. On logout/workspace switch, isolate or clear cached data and prevent queued drafts from being sent to the wrong workspace.
- [ ] Add deep links and privacy-aware notification content; obtain OS notification permission through normal user flows.
- [ ] Test real Android/iPhone installs, process death, network loss after successful save, expired sessions, background/resume, push delivery, and accessibility.

Acceptance: airplane-mode capture survives restart; reconnect creates one entry even if the first response was lost; another user's login cannot see drafts. Actual-device receipts distinguish simulator success from device acceptance.

External gate: verify current Apple/Expo signing access before promising an installable IPA. The planned EAS internal iOS route requires valid provisioning for the receiving device. Android internal builds and web work can proceed independently.

### M10 — Onboarding, performance, and pilot acceptance

- [ ] Provide resumable setup: household currency/timezone, accounts, opening-balance date, existing-history preview, recurring bills, first reconciliation, and optional partner invite. Skip bank setup when unavailable.
- [ ] Keep example data in a separate demo; never seed examples into a real household. Reconcile opening balances with the import cutoff so historical transactions are not counted twice.
- [ ] Add contextual empty states, keyboard and screen-reader coverage, plain-language error recovery, and compact/comfortable density without shrinking mobile targets.
- [ ] Optimize measured bottlenecks: scoped query indexes, server pagination, aggregates, deferred modules, appropriate cache invalidation, and bounded exports. Never cache authenticated financial responses across users/workspaces.
- [ ] Exercise large workspaces and concurrent usage with synthetic data, including recurrence and bank jobs running during edits.
- [ ] Invite a small consenting pilot only after permission/recovery gates pass. Observe setup, manual capture, import review, reconciliation, forecast explanation, and weekly household review.
- [ ] Add a feedback route, issue severity/response process, feature limitation page, privacy/retention documentation, and export/account closure workflows. Obtain jurisdiction-appropriate review before a wider public launch; do not claim compliance certification from this plan.
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
