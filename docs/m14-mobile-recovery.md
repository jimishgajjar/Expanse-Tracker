# M14 — Mobile and recovery evidence

**Updated November 6, 2026. Acceptance remains open.** A successful browser test or bundle export cannot establish actual iOS/Android usability, secure OS storage, screen-reader behaviour or notification privacy. A successful local database restore cannot establish recovery after losing the original Windows profile. These are release gates, not tasks to mark complete from simulated results.

Base commit: `6e0ad8a6147935a587af0042a03517eb7cd8fca2`, plus the M14 working changes. No production schema, balances, transactions, bank flags or deployment were changed for this milestone. All posting tests used a synthetic local tracker.

## Changes

- Encrypted backups now support a timed, fresh disk restore, a close/reopen check, exact table-content comparison and account-balance fingerprints. Every run gets a unique destination; it cannot overwrite the live database or a previous drill.
- The Windows recovery wrapper restricts the directory before writing plaintext recovered data. It reuses the existing DPAPI-protected key, does not rotate it, and refuses conflicting release/report options.
- Added a synthetic recovery regression command and a loopback-only delayed/lost-response proxy. The proxy does not log transaction payloads, credentials or cookies.
- Increased phone tag-entry font size to 16px and tag actions to 44px. Capture type buttons and the save-another label now provide 44px phone targets. Transaction descriptions wrap instead of truncating.
- Added authenticated, passphrase-wrapped portable recovery keys with masked PowerShell prompts. Export preserves the existing DPAPI key; restore accepts the portable key through stdin and never connects to production. See [portable recovery instructions](../BACKUP-RECOVERY.md#prepare-a-portable-recovery-key).

## Completed recovery evidence

The selected archive was 11 minutes 15 seconds old when the drill started. Restoration and disk reopen took **5.285 seconds**. All 58 tables, 416 rows, 3 accounts, 321 transactions and 1 transfer matched. Account-balance fingerprints matched after reopen. The pre-upgrade archive also passed its archived-schema restore after the tooling changes.

Private receipt: `backups/recovery-drills/restore-H8iab8/receipt.json`. The receipt identifies the original ciphertext, schema, timing and fingerprints; financial records are not included in this document. Original encrypted archives were retained.

The synthetic regression additionally proves an expected **107.63** balance, unique restore destinations, retention of an earlier recovered copy, rejection of a damaged archive and wrong key, and refusal to drill without an archive. It supplies an invalid production URL deliberately: recovery never uses it.

The installed scheduled task's last result was `0`, with catch-up enabled, three retries ten minutes apart and a thirty-minute execution limit. Its observed next run was November 5 at 19:00 Toronto. The corrected runbook describes the difference between that installed trigger and the installer's 20:00 request.

**November 6 archive recheck:** the scheduled snapshot at `00:00:08Z` passed a new disk restore and reopen in **5.016 seconds**, with a snapshot age of about **8 hours 38 minutes**. All 58 tables, 416 rows, 3 accounts, 321 transactions and 1 transfer matched. Private receipt: `backups/recovery-drills/restore-b2Dsh3/receipt.json`. This read the existing encrypted archive only; it did not connect to or write production. The synthetic portable-key rehearsal covers a new process without `BACKUP_KEY` or DPAPI, wrong-passphrase rejection and refusal to overwrite an existing key file. It is not proof that the actual recovery key has been copied off this computer.

The final synthetic rehearsal also exercises the PowerShell restore wrapper and directory protection, with its masked prompt stubbed using a generated fixture secret. It restores the same balance without a DPAPI file. No real key or passphrase is used. An initial attempt to create dependency junctions was blocked by the sandbox; the wrapper now resolves its runtime relative to its own script, so the rehearsal succeeds without junctions. Combined validation passes 50 files / 347 tests, web TypeScript, focused lint, PowerShell syntax and the isolated production build; see `backups/m13-m15-validation.json`.

## Browser and native evidence

At a 390×844 browser viewport, Add → expense → lost confirmation → retry → account history completed against the optimized local web build. The harness delayed requests by 1.5 seconds and dropped the first save response after the upstream returned HTTP 200. The form announced an alert and kept the same amount and note. Retrying the unchanged form produced **one 7.37 expense**, six total fixture entries and the expected **1,367.63** fixture balance. A separate database process confirmed the result after the web server stopped. This proves same-form retry; it does not claim web drafts survive closing the browser.

Private artifacts: `backups/m14-retry-receipt.json` and `backups/m14-phone-retry.jpg`. On the updated development preview, a 320×740 viewport showed no horizontal document or dialog overflow. The three capture-type buttons and tag input measured 44px high; tag text measured 16px. Eight successive Tab steps stayed inside the labelled dialog, and Escape returned focus to Add transaction. Keyboard activation deferred the synthetic savings-goal item and finished the weekly review; its saved receipt showed one deferred item and none left open. The amount and account history came from the earlier production-build retry check; the weekly-review check used development feature gates.

Additional private screenshots: `backups/m14-phone-capture.jpg` and `backups/m14-weekly-review.jpg`. Accessibility-tree labels, focus and live alerts were inspected; no actual screen reader or OS large-text setting was tested. Browser zoom shortcuts did not alter the in-app viewport, so narrow reflow must not be reported as a 200% text test.

Seven focused automated test files / eleven tests passed for native draft recovery, interrupted vault writes, notification destinations, tracker-access isolation, Activity state and server creation receipts. Web and mobile TypeScript checks and focused ESLint passed. The optimized web build passed with a staging-checkout root warning; no compile/type error remained. Native storage, unlock and network failure are test doubles in the automated tests.

Android and iOS Hermes bundle exports also passed (3,852 and 3,845 modules respectively), using a synthetic loopback API address with Expo networking and telemetry disabled. Artifacts are under `backups/m14-native/android` and `backups/m14-native/ios`. They are JavaScript/asset exports, **not an installable APK or signed IPA**. The sandboxed Android export stalled at Metro startup; the successful run used the normal local process context. No cloud build or distribution occurred.

## Repeat the checks

1. Use an isolated synthetic tracker and clear external database, bank, email and push credentials. Never run posting checks against the live app.
2. Run `npm run rehearse:recovery`; for an actual encrypted archive use the PowerShell `-VerifyFile ... -RecoveryDrill` command in [BACKUP-RECOVERY.md](../BACKUP-RECOVERY.md).
3. Run `node scripts/mobile-network-proxy.mjs <local-app-port> <unused-local-proxy-port>`. Open `http://127.0.0.1:<local-proxy-port>`. The harness binds only to loopback and accepts only its own origin.
4. Fill an expense form. Immediately before saving, write `{"delayMs":1500,"dropNextAction":true}` to the ignored `backups/m14-network.json`. The next Server Action response is consumed and dropped once. Wait for the alert; retry the unchanged form. Verify a single receipt, transaction and balance movement. Reset the file to `{"delayMs":0,"dropNextAction":false}` and stop the proxy when finished.
5. Follow the complete [physical-device checklist](m9-native-acceptance.md). Use the actual install/build identifier, model and OS in each receipt. Do not substitute bundle exports for installed builds.

## Outstanding release gates

| Gate | Required evidence |
| --- | --- |
| Android | Actual install, native tabs, keyboard/safe areas, largest text, TalkBack, offline save/force quit/reconnect, revocation, and cold/warm notification privacy. No connected phone was confirmed for this run. |
| iPhone | Same checks with VoiceOver and an actual provisioned install. Apple signing remains an external prerequisite; no membership was supplied. |
| Performance | Consenting participants' deployed mobile and desktop p75 LCP ≤2.5s, INP ≤200ms and CLS ≤0.1. No participant samples were supplied; do not infer performance from local build time or database benchmarks. |
| Computer/profile loss | Export the real portable key using the local masked prompt, independently store it and an archive, and restore on a replacement environment. Tooling is implemented; the actual independent copy and replacement-machine test are unconfirmed. |
| Full recovery time | Clean replacement environment, app/auth checks, reconciliation of post-snapshot writes and controlled cutover within four hours. The 5.285-second result measures database restoration only. |

Existing consent controls are in Settings → Optional pilot page timings. Timing stays in the tab until voluntarily shared; use `npm run pilot:report -- <anonymous-evidence.json>` for device-specific p75 and sample counts. Label development/lab samples separately. Never populate missing participant measurements with synthetic values.
