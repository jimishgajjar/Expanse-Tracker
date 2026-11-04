# M3: Plaid Sandbox provider check

This is the first M3 provider implementation, separate from the existing simulator. It is a local command, not a dashboard feature. It has no database dependency, receives no workspace or ledger identifiers, and cannot post to the ledger. It sends requests only to the fixed Plaid Sandbox HTTPS origin. It does not read the project's normal dotenv files.

## Run with a Plaid Sandbox developer account

Create the Git-ignored file `.env.plaid-sandbox.local` at the repository root, with the two entries below. Replace the placeholders locally using **Sandbox** credentials from the Plaid Dashboard. Do not use a production secret, put credentials in chat or commit the file. The same names can instead be supplied as process environment variables. Keep this file on the local development machine.

```dotenv
PLAID_SANDBOX_CLIENT_ID=<your client ID>
PLAID_SANDBOX_SECRET=<your Sandbox secret>
```

Run `npm run bank:sandbox`. This intentionally creates one synthetic test Item in your Plaid Sandbox account. The command refuses a production, Vercel, or database-connected process; if keys are absent it exits before making any provider request. Unset any process-level DATABASE_URL before running (do not modify the web app's configuration).

1. Request a Canadian English Link token for Transactions using a random synthetic user identity.
2. Independently create a test Item at First Platypus Bank using the Sandbox dynamic-transactions persona. This **bypasses the Link UI**: it verifies the backend exchange path, not an interactive Link login, consent, or OAuth return.
3. Exchange the public token once; confirm that the returned account list belongs to the same Item. Choose the synthetic checking account only. Request an update-mode Link token for the existing Item.
4. Request transaction changes scoped to that account, retaining only transaction ID, account ID, date, provider-signed amount, currency and pending linkage in memory. No currency conversion, classification, balance calculation, or posting takes place. Read again from the returned cursor. A not-ready feed is polled a bounded number of times; an empty dynamic fixture does not pass.
5. Remove the test Item in a finally block once an access token is available. A successful run prints counts and update status, not tokens, account IDs, balances, or transaction descriptions. Nothing is persisted. On cleanup failure, an interrupted process, or an uncertain creation/exchange, check Sandbox Items before running again. The tool never recreates an Item automatically.

The collector stages every page against a copy of the previous account feed. A pagination mutation discards the entire attempt and restarts at the original cursor, up to two retries. Other failures leave the caller's previous feed unchanged. This does **not** implement persistent storage, worker leases or cross-process concurrency control.

## Evidence and next gate

`npm test -- src/lib/__tests__/plaid-sandbox.test.ts` exercises the real adapter with synthetic HTTP responses: initialization and update requests, account scoping, incremental reads, pending replacement, page restart, failure handling, cleanup, and redaction. Those results are not authenticated provider acceptance. Run the command with Sandbox credentials and retain only its aggregate result to establish that boundary.

The dedicated interactive preview below now adds these capabilities locally. Fold the validated flow into a durable hosted design only after the remaining gates pass. Durable jobs, signed webhooks, reviewed imports, real RBC/TD coverage, account-specific costs and live consent remain separate gates. No production environment change or database migration belongs to this step.

Provider references: [Link token API](https://plaid.com/docs/api/link/), [Sandbox public-token creation](https://plaid.com/docs/api/sandbox/), [Sandbox test institutions](https://plaid.com/docs/sandbox/institutions/), [dynamic test persona](https://plaid.com/docs/sandbox/test-credentials/), [transaction sync and account-specific cursors](https://plaid.com/docs/api/products/transactions/), [Item token exchange and removal](https://plaid.com/docs/api/items/).

**3 November 2026 verification:** 202 tests passed across 16 files, including 13 new offline adapter and sync checks. TypeScript and targeted ESLint passed. The unconfigured command refused to run before making any provider request. No authenticated Plaid result or RBC/TD coverage is claimed.

**Authenticated Sandbox receipt — 3 November 2026.** Plaid accepted the initial Link token request, test Item creation/exchange, account lookup and update-mode Link token request. The single-account sync read 69 synthetic transactions across seven initial pages, followed by one incremental page; status was HISTORICAL_UPDATE_COMPLETE. Item removal succeeded. The authenticated run exposed a request-shape mismatch: the account filter belongs under options.account_id, not at the top level. The adapter and its regression test now enforce that shape. No tokens, account identifiers or transaction descriptions are included here. This was a headless provider check, not an interactive Link session or a real RBC/TD connection.
## Interactive local bank inbox

Bank tools are paused by default, including the Accounts link, direct page and review actions. For an intentional local development session, set `BANK_TOOLS_ENABLED=1` in the launching shell before using the steps below. Disabling the tools preserves the existing local connection and review data.

Run `npm run dev:bank-sandbox`, then open http://127.0.0.1:3122/?tab=accounts and choose **Connect bank**. This uses a dedicated seeded application workspace (demo@demo.com / password) and a separate bank database. Other preview modes and production do not expose the interactive flow.

1. Choose **Connect bank** and use Plaid's *Sandbox* screens. Use test credentials only. For example, choose a non-OAuth test institution such as Tartan-Dominion Bank of Canada, with the supported Plaid test username and password. Cancelling before success discards the local setup intent without exchanging a token.
2. After Link returns, explicitly select one supported checking, savings or card account. The server verifies it against the provider's account inventory. Until selection and manual sync, no feed rows are retrieved.
3. Choose **Sync transactions** to fetch bank activity for review. Close/reopen the page or restart the local server with the same command. Sync resumes using the saved account-specific cursor. **Repair sign-in** requests update mode on the existing Item without another token exchange.
4. Open **Review** on a posted payment. Choose a local tracker account and category, then **Preview entry**. For different currencies, enter the amount settled in the tracker's currency. Match a suggested entry with the same amount and direction within seven days, confirm an import, or ignore the payment. Decisions survive resyncs. The preview stores a receipt alongside the local ledger, so an interrupted or repeated import cannot book the same provider transaction twice.
5. **Disconnect → Confirm disconnect** requests provider revocation first, then removes this connection and its inbox. On an unconfirmed revocation the token is retained for retry and sync is disabled. An interrupted token exchange is not automatically retried. If the exchange is still unresolved after a minute, review the Sandbox Items, revoke any orphan if needed, then explicitly clear the unconfirmed attempt in the app.

The interactive preview binds to loopback. Server actions check the local-mode configuration, browser origin, active workspace and owner role on every operation. The provider access token is sealed with AES-256-GCM using a per-write IV and workspace/connection context. The local key is outside the repository under the user's .expense-tracker-sandbox directory (Windows current-user DPAPI, Unix private key file). Keep this key if retaining the local test connection. Sandbox credentials and the encryption key never go into browser props. Bank data and the encrypted token live in .pglite-bank-inbox; the isolated app workspace is in .pglite-bank-preview. Only a confirmed import writes a transaction to the isolated app workspace. Disconnecting preserves those entries and their receipts.

A complete account sync commits rows and cursor together, guarded by connection identity, phase and version. If another sync or disconnect wins first, stale results cannot replace its state. This is an isolated single-machine implementation; production queue/webhook delivery, key management and consent/recovery requirements remain separate.

Plaid's web client is loaded from its [official CDN as documented](https://plaid.com/docs/link/web/). This slice targets a non-OAuth Sandbox institution, not live RBC/TD or OAuth redirect completion.

**Interactive slice verification (3 November 2026).** An authenticated, isolated provider/store rehearsal used one synthetic checking account. Its 69 observations and encrypted token survived reopening the database; the next account-scoped sync retained 69 unique IDs. Update-mode token creation, provider revocation and clearing the local inbox succeeded. This rehearsal used a Sandbox public token, not an interactive consent callback. In the browser the local owner opened Plaid Link, cancelled successfully, and opened it again. After the Sandbox consent and test login were completed, the actual Link callback returned to the local app. One Plaid Checking account was selected; its first browser sync displayed 18 transactions. Reloading and syncing again retained 18 entries. The interactive connection was left available in the local inbox; the separate headless rehearsal Item was revoked. No live bank or production database was used.
