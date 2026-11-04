# M9 mobile coverage and acceptance

## Feature parity

| Workflow | iPhone and Android | Website |
| --- | --- | --- |
| Overview and balances | Reads the tracker’s account and period totals. Reviewed books show liquid cash, debt, net worth, and incomplete valuations from the financial-position service. | Same backend calculations and permissions. |
| Activity and account history | Search and filter by income, expense, or transfer for the selected period. Transfers show their source and destination. | Also supports advanced search, reconciliation, and imports. |
| Capture and edit | Add income, expenses, and online transfers. Income and expense drafts can be saved on-device. Editing or deleting an entry checks the version the member opened. | Existing capture, receipt and allocation workflows. |
| Bills, categories, goals, splits and members | Dedicated screens in More. Planning and forecasts open in the signed-in website. | Full planning and household administration. |
| Debt and currencies | Shows the server's reporting totals. Original reports require an explicit choice once a reporting book is configured. More opens the website for bookings and valuations. | Owns advanced bookings, denominations and valuation review. |
| Reminders | Settings manages member choices and requests OS permission. Ordinary activity and insights taps open native screens. Mention, invitation, and planning links open the configured website with its own access checks. | Shares audience and privacy rules. |
| Navigation | iOS system tabs and Android navigation with a central Add button. Drafts and filters use labelled, wrapping controls. | Responsive dashboard and detail pages. |
| Offline | Local unlock exposes the member’s saved device drafts. The ledger, transfers, bank access and posting require connectivity. | Web saved drafts use their existing server workflow. Device drafts stay on the phone. |

## Using device drafts

1. Sign in online and enable **More → Settings → Enable phone lock**. Verify the phone’s biometric or device credential.
2. Use **Add → Save as device draft** or **More → Device drafts**. When offline, unlock the app and select **Open offline drafts**. Save before closing the app. The phone keeps up to 20 drafts per member and tracker.
3. Reconnect, check tracker access, and open the draft. Choose an active account and review the amount, date, category and tags. Select **Post to Activity**.
4. If confirmation was interrupted, select **Check receipt**. The phone retries the original request with its frozen fields. A conflicting or subsequently deleted entry remains available for comparison and requires a decision.

The native keychain or keystore encrypts draft storage. Scope includes the API origin, user, and tracker. Signing out removes offline access. The same member can recover their drafts by signing back into the same tracker on the same phone. Offline access lasts at most seven days after full verification and ends earlier if the session expires. A server revocation takes effect when access can be checked again.

## Local verification

On November 4, 2026, 310 automated tests passed across 45 files. The mobile TypeScript check, both platform bundle exports, and the optimized website build passed. A separate loopback HTTP run pinned to that website build signed into a fresh in-memory ledger, posted the same request twice, and confirmed one transaction and one balance change. It also rejected another tracker, rejected a stale edit, and returned an unauthorized response after logout.

- The recovery test uses the mobile auth and draft code, the HTTP route handler and an in-memory PostgreSQL ledger. It simulates a lost response after commit, a fresh app process, a cancelled unlock, a tracker switch, session expiry, another login and a conflicting receipt. OS credential and storage APIs are test doubles.
- The storage test interrupts a snapshot write before the commit marker and checks recovery and stale-revision rejection. Database tests separately exercise replay, deletion, role changes and concurrent editing.
- Run the repository suite with `npx vitest run --maxWorkers=1`. Run `npx tsc --noEmit` in the mobile directory. The optimized website uses `npm run build:finance` with its isolated database settings.

## Physical acceptance still required

Use a native development build that includes Expo LocalAuthentication and SecureStore. Use only synthetic accounts on an isolated backend. Set `EXPO_PUBLIC_API_BASE` explicitly before starting Metro or building the client. The normal release configuration points at the live website.

For an Android USB development run, start `npm run dev:finance` in the repository. Run `adb reverse tcp:3138 tcp:3138`, set the client API to `http://127.0.0.1:3138/api/mobile`, and start the mobile development client. A physical iPhone needs a reachable isolated HTTPS backend and a provisioned install. The Expo account had no registered Apple team on November 4, 2026.

Record the build identifier, device model, OS, and result for each row. Keep account details out of receipts.

| Run on each phone | Acceptance condition |
| --- | --- |
| Fresh install, sign-in, and unlock | Native tabs and Add work. Accept, cancel, and fall back to the device passcode. Returning from the background requires unlock when enabled. |
| Airplane mode and force quit | Save a draft, terminate the process and reopen offline. After unlock, the saved amount and note are present. The ledger remains inaccessible. |
| Lost response and reconnect | Interrupt confirmation after the isolated backend records the entry. Restart and check the receipt. Activity shows exactly one ledger entry. |
| Session and household isolation | Switch trackers, revoke the session, then sign in as another member. Their ledger and draft list show only their own scope. |
| Push on a development build | Decline and then grant permission. Send a synthetic opted-in reminder. Check lock-screen privacy and its destination on both cold and warm starts. |
| Accessibility | Use VoiceOver or TalkBack and the largest text setting to navigate tabs, edit a draft, select an account, cancel unlock and find any error message. Check focus, wrapping and safe areas. |
