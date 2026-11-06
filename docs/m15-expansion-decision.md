# M15 — Evidence before expansion or bank connectivity

**November 6, 2026: implementation ready; participant acceptance pending.** No four-week household results have been supplied. The current report returns `hold_for_evidence`. It does not change app flags, create connections, charge a provider, contact households or write a database. Passing checks would recommend an owner review of a small second cohort, not declare a paid product viable.

## Run the decision report

For a fresh pilot, run `npm run pilot:prepare -- YYYY-MM-DD`. It creates a unique folder under `backups/pilot-sessions/` containing five blank worksheets, the synthetic statement, operating instructions, `phase-evidence.json` and an initial `phase-report.json`. Existing packets are never replaced. All outcomes and costs remain unknown; preparing H01–H05 sheets does not enroll anyone. Open its `START-HERE.md`. Confirm restricted filesystem access before adding observations; Git ignoring alone does not restrict who can read a file.

If an evidence file already exists, keep using it. To create only an empty evidence file manually:

```powershell
Copy-Item docs/phase-evidence.empty.json backups/phase-evidence.json
npm run phase:decision -- backups/phase-evidence.json
```

Use a new destination if a local evidence file already exists; retain dated inputs and reports. `node node_modules/tsx/dist/cli.mjs scripts/phase-decision.ts backups/phase-evidence.json` emits JSON without npm's command banner if saving stdout. The report includes an SHA-256 of its input. No database, provider or feature-flag configuration is read. Invalid files fail without printing entered values.

Keep participant evidence in ignored private storage, not in a public commit. The committed template contains **no observations**. `kind` distinguishes `uncollected`, synthetic `rehearsal`, and consenting human `observed` evidence. A rehearsal can test the workflow but cannot pass the observed-cohort gate. This is an operator-entered assessment: the program checks consistency and calculations, not whether an assertion is truthful. Keep original consent and supporting receipts separately.

## Collect only the fields needed to decide

Use the original five anonymous codes H01–H05. Do not replace a household that struggles or stops with a successful newcomer. `enrolledOn` and `asOf` use YYYY-MM-DD; enrollment is day 0. Observe voluntary returns on days 21–27, then finalize the original household's outcome on day 28 or later. The report's `cohort.followup` gives exact start/end/readout dates, days remaining, and waiting/observing/ready states. Readiness does not mean the outcome is known: missing or withdrawn observations remain null, never false by default. Week-four result fields remain null until the complete window has elapsed. The report rejects duplicated codes, future enrollment, premature outcomes and inconsistent denominators. `consented` must be true; do not add people who have not consented. No names, emails, balances, notes, transaction details, credentials or free text are accepted by the strict schema.

For each eligible original household record whether it returned, completed a weekly review voluntarily, and correctly explained the M13 purchase result **without help**. Record one primary reason supplied by the household: return reasons are shared review, spending decision, bill tracking, habit or other; stop reasons are manual import, setup, unexplained balance, privacy, cost, no value or other. Leave missing outcomes null. Returning alone is not a completed voluntary review. Assisted comprehension is not unassisted comprehension.

The `metrics` object reuses [pilot operations](pilot-operations.md): distinct-household setup/task counts, measured support minutes, unresolved critical incidents, actual monthly invoice costs, and mobile/desktop p75 inputs. Enter `null` for unknown costs; `0` means a verified zero. Its month must match `asOf`. `activeHouseholds` is the stated month's active count within the original cohort; invoice and support costs must cover that same period. If shared costs are allocated, preserve the allocation basis privately rather than treating them as free.

Set `readiness` from actual release evidence. Bundle export is insufficient for Android/iOS acceptance. `independentRecovery` needs a replacement-environment receipt using independently retained ciphertext and a protected key. `vitalsSource` must be `participant` to pass performance gates; lab timings stay separate. Small sample counts are shown and remain provisional, even when p75 is under target. Select only the platforms being considered; unfinished iOS acceptance does not automatically prevent a separately validated web pilot.

Set the owner's acceptable support minutes and delivery cost per active household, plus an hourly value for support/recruiting time. Money strings allow at most two decimal places; all amounts share `metrics.currency`. Delivery cost includes infrastructure invoices and support labor, with exact-cent rounding. Unknown limits or a zero active denominator remain unknown. This excludes unmeasured engineering, tax and opportunity cost, so a passing pilot cannot establish profitability.

Keep `interested`, stated `willingMonthly`, and actual `paidMonthly` separate. Zero payment is different from an unknown payment. Interest never becomes booked revenue. Do not start charging participants because a report passes.

## Interpret the report

| Result | Next action |
| --- | --- |
| `hold_for_evidence` | Collect missing observations. Preserve nulls and the original cohort. |
| `fix_before_expansion` | Address failed comprehension, critical incidents, release checks, cost/support limits or performance before a larger cohort. |
| `ready_for_owner_review` | Review a small second cohort using one recruitment channel. Owner approval is still required. |

Passing requires five observed original households, four weeks of follow-up, at least 4/5 unassisted setup and purchase comprehension, at least 3/5 voluntary weekly reviews, each household's reason, zero unresolved critical incidents, selected-platform acceptance, independent recovery, participant p75 LCP ≤2.5s / INP ≤200ms / CLS ≤0.1, and measured costs/support under the owner's limits.

If testing one recruitment channel, record invitations, activations, eligible four-week households, returns, cash spend and operator hours in `recruitment`. Its denominator is separate from the original five-household cohort. Cost includes operator labor, with cost per activation and per four-week return. No returns means an unknown per-return cost, not zero. Repeated cohorts and retained paying customers would still be needed to evaluate sustainable acquisition and delivery economics.

## Optional bank branch

The report always returns `bank.enabled: false`. Leave `ownerDecision: defer` until the owner explicitly chooses to evaluate banks. Generic milestone completion is not that decision.

Observation-only owner review is available only after the core gates pass, at least two households report manual import as a leading reason for stopping, and all bank prerequisites are supplied. Name the exact intended RBC and TD account types in `intendedAccounts`, then record Canadian Transactions coverage for **each** pair in `coverage`, with verification dates. Obtain actual provider pricing and an owner-approved cap in the reporting currency. Coverage and quote evidence older than 30 days needs refreshing; 30 days is this report's review policy, not a provider coverage guarantee. Production access, consent/deletion/incident review, and a disconnect/replay/pending-to-posted rehearsal must be confirmed.

No current RBC/TD support, price or production approval is asserted by this template. Verify these with the provider when pursuing that branch. Keep a provider receipt separately; do not enter keys or bank logins here. A passing report is still only an owner review for one consenting household in observation-only mode. Explicit Match existing / Import / Ignore and exact reconciliation remain required before any ledger mutation. Manual file review remains available.

## Current evidence

The empty template produces `hold_for_evidence`, unknown economics, M13 comprehension not accepted, and `keep_disabled` for banks. Dated local output is `backups/m15-decision-2026-11-06.json`. Tests exercise invalid counts/dates, strict anonymous fields, missing costs, support labor, separate willingness/payment, failed incidents, platform gates, provisional timings, acquisition denominators and bank blockers. Synthetic passing fixtures are tests only and are not pilot results.

**Combined M13–M15 validation, November 6:** 50 test files / 347 tests passed with one worker. Web TypeScript, focused lint, PowerShell syntax, the secure-prompt synthetic recovery rehearsal and an isolated optimized Next build passed. The first build attempt hit sandbox font-download/file-write restrictions; the successful retry used normal local permissions with external credentials disabled. A workspace-root warning remains specific to the nested build checkout. Private receipt: `backups/m13-m15-validation.json`. No migration, deployment, production write, real-key export or bank activation occurred. Physical phones, participant observations/performance, actual independent recovery and full app cutover remain acceptance gates.

**Later pilot-preparation validation:** 12 focused tests cover the decision report and follow-up calendar, including days 20/21/27/28, Toronto clock changes, leap/year boundaries and unknown outcomes after eligibility. TypeScript and changed-file lint pass. Running packet preparation twice created different directories and left every first-packet file unchanged; an invalid date created no packet. Initial evidence remained uncollected with 0 households and banks disabled. Private receipt: `backups/pilot-preparation-validation.json`. The earlier full-suite/build evidence remains a dated snapshot; this follow-up changes operator tooling and documents, with no application routes or ledger mutations.
