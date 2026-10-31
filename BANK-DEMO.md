# Bank connection demo

This milestone demonstrates the review workflow using invented RBC and TD data. It is not connected to RBC, TD or Plaid. No API keys or bank login are needed.

## Run

```powershell
npm run dev:preview
```

Open `http://127.0.0.1:3107`, sign in to the existing local preview account, and use **Accounts → Try bank demo**. Direct route: `http://127.0.0.1:3107/bank-demo`.

The preview command explicitly disables the remote database, outbound email/push credentials and Plaid credentials. The demo is rejected in production and on Vercel even if its mode flag is accidentally set. Members/viewers cannot access it. No public/proxy exemption was added.

## Walkthrough

1. Connect the **RBC sample** to **Everyday chequing**, and the **TD sample** to **Rainy-day savings**. Confirm the sample CAD ledger and keep the default 13 October 2026 start date. These are invented ledger accounts, separate from your existing application accounts.
2. Click **Check sample feed** on each card. The demo ledger still has only its two seeded entries. Repeat sync to verify nothing is duplicated.
3. Select **Neighbourhood coffee** and **Match existing entry**. It links the existing $6.50 manual entry. **City hydro** matches a seeded $75 scheduled bill. Neither creates a second payment.
4. Select **Weekend groceries**, choose a category and import it. Or select groceries and payroll, review the batch summary, then confirm. Only these explicit decisions change the sample ledger.
5. Select **Transfer to savings**, then pair it with TD. Two feed rows produce one $300 transfer; income and spending are unchanged.
6. Use **Pending** to inspect **Corner shop**: importing is blocked. Under the RBC card’s **Test bank changes**, run step 1. The pending row is replaced by a posted payment that can now be reviewed. If you had ignored the pending row, the posted replacement remains ignored.
7. Import payroll/groceries before running RBC step 2. The bank now corrects groceries from $86.42 to $90.42 and removes payroll. Both appear in **Changes**. Original ledger values are retained; **Keep existing ledger entry** records an explicit review decision.
8. USD, refund and pre-cutoff entries cannot be imported. They remain available for inspection or Ignore. Reverse Ignore from the Ignored view when appropriate. Removed/replaced entries cannot be restored.
9. Simulate an expired login, reconnect and refresh. Disconnect also retains the ledger and decisions. Used mappings and start dates stay locked. Reconnect using the same mapping to continue.
10. Open the **Demo ledger** and **Decision history** sections. Reload to confirm persistence. Open a second browser tab to try stale-state handling: an outdated action gets a conflict and requires refresh.

**Reset demo** restores this simulator’s two sample ledger entries. It does not touch application accounts, transactions, recurring rules or backups.

## Architecture

- `src/lib/bank-demo/model.ts`: deterministic feed fixtures, integer-cent calculations, matching rules and immutable command transitions.
- `src/lib/bank-demo/store.ts`: dedicated PGlite database with per-workspace snapshots and atomic optimistic concurrency. A failed decision writes nothing.
- `src/lib/bank-demo/config.ts`: fail-closed environment checks.
- `src/app/api/bank-demo/route.ts`: owner/session scoping, same-origin POST checks, bounded and validated input, no-store responses and sanitized errors.
- `src/app/bank-demo/page.tsx`, `src/components/bank-demo.tsx`: local-only, responsive review UI.
- `.pglite-bank-demo/`: ignored sample persistence. No application migration or backup script changes are necessary for this simulator. Reset through the demo UI.

The demo stores only a workspace identifier plus synthetic data. It never reads application transactions or uses the app’s create/update/delete ledger actions. Visiting the normal preview dashboard still follows its existing local seed/recurring behaviour.

## Verification commands

```powershell
npm run test -- src/lib/__tests__/bank-demo.test.ts src/lib/__tests__/bank-demo-api.test.ts
npm run test -- --maxWorkers=2
npm run lint
npm run typecheck
npm run build:preview
```

The automated cases cover mode restrictions, owner authorization, workspace isolation, CSRF/body validation, duplicate matching, pending replacement, transfer pairing, correction preservation, ignored-state preservation, batch rollback, persistence and conflicting approvals. They use disposable, in-memory PGlite databases.

### Verification receipt — 13 October 2026

Story: Accounts opens the local bank demo; owner-scoped API commands persist reviewed synthetic payments in a separate PGlite database and render the updated sample ledger.

| Boundary | Observed result |
| --- | --- |
| UI entry | Accounts → Try bank demo opens `/bank-demo`. |
| UI → API | RBC/TD setup, sync, matching, import, transfer pairing and batch confirmation returned HTTP 200. |
| API → storage | PGlite concurrency tests allowed one of two simultaneous approvals; reloading the browser retained 5 demo transactions and one transfer after the walkthrough. |
| Storage → UI | Coffee matched without insertion; groceries imported; both transfer sides linked to one transfer; payroll and the newly posted Corner shop payment imported through a reviewed batch. |
| Bank correction | UI displayed updated bank groceries of $90.42 beside the unchanged $86.42 ledger amount. Removed payroll also required review. |
| Application isolation | Returning to Accounts showed the same three original preview account balances observed before demo actions. Production database and schema were not accessed or modified for this demo. |
| Responsive UI | At a 390px viewport, document width was 375px with no horizontal overflow; selecting an entry moved focus to Transaction review. Desktop and mobile screenshots are saved locally under `.codex/bank-demo/`. |
| Automated checks | 91 tests passed across 10 files, including 30 bank-demo tests. Lint, TypeScript and isolated production build passed. |

Browser testing found a local-origin mismatch: Next normalized its internal request URL to `localhost`, while the browser used `127.0.0.1`. The POST check now compares Origin to the request Host and protocol; a regression test covers this case while cross-origin requests still fail. No authentication or production-mode gate was relaxed.

## What comes next

Once a Plaid developer account is available, implement the real server-side provider adapter against Sandbox, then add separate bank-feed/import-link tables, verified webhook handling, durable jobs, encrypted tokens and the complete import audit. These have **not** been implemented or tested by this simulator.

Before real bank access: confirm Canadian RBC/TD account coverage and pricing; review permission/retention requirements; rehearse backups and additive migrations; test Neon concurrency and interaction with recurring posting/deletion/undo; then run one selected live account in observation-only mode. Real ledger approval remains a separate rollout step.

The demo’s whole-workspace snapshot storage is suitable for a small local simulator. It is not the planned production persistence design. Refund reconciliation, correction/reversal posting, real transfer matching, provider balances, historical backfill, paging large feeds and native mobile Link remain future implementation work.
