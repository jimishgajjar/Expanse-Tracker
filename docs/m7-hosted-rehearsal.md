# M7 household release rehearsal · 4 November 2026

**Staging passed the server privacy checks. Physical phone and inbox acceptance are open.** The [protected Vercel preview](https://expanse-tracker-7adhxfwwy-jimishgajjars-projects.vercel.app) uses a disposable Neon project with synthetic records. The test database expires on 7 November 2026 at 05:40 UTC. The production site and database were outside this rehearsal.

| Check | Result |
| --- | --- |
| Migrations and recovery | Compared the original synthetic account and transaction rows before and after migrations 0023–0028, then again after exercising sharing and reimbursements. A separate encrypted backup rehearsal verified both the older and current backup formats and restored the financial rows, share, mention and preferences. |
| Concurrent actions | Two independent PostgreSQL sessions opening one person's private ledger returned the same ledger. Concurrent retries of a mentioned comment created one comment. A reimbursement linked an existing payment. |
| Household visibility | The protected web and mobile endpoints returned the synthetic household balance of 88.00. Its private account name was absent from Activity search, mobile bootstrap, household tools, comments and the downloaded workbook. The forecast read the same 88.00 opening balance from hosted PostgreSQL. |
| Private receipt | The named recipient received the approved image bytes. The household owner could not open the same link. Removing the recipient invalidated their existing receipt link, mobile session view and shared comment access. The remaining owner retained access. |
| Notification routing | The hosted mobile API saved and cleared the invitation and mention push choices independently of email. Posting the same mention twice over HTTPS created one comment. Local tests also cover invitation replays, stale grants, private comments, removed recipients and notification taps from a cold or running app. Real inbox receipt and phone delivery still require a consenting tester. |
| Build and regression checks | All 300 tests across 41 files passed. The web and mobile type checks passed. Expo exported both iOS and Android bundles configured for this preview. Physical installation, push delivery and background/resume still need device verification. |

## Repeating the rehearsal

1. Use an empty disposable Neon project. Supply its control connection as `M7_REHEARSAL_URL` and its independently verified project ID as `M7_REHEARSAL_PROJECT` to `node --import tsx scripts/rehearse-m7-hosted.ts`. This creates a new test database and prints only its name. Both scripts require explicit test credentials.
2. Deploy web source to a **preview** with `HOUSEHOLD_RELEASE=staging` and the new test database as its build and runtime `DATABASE_URL`. Use only synthetic accounts. Keep mail credentials and `M7_TEST_EMAIL` empty during automated runs.
3. Set `M7_REHEARSAL_URL` to the newly minted database, `M7_PREVIEW_ORIGIN` to the exact deployment URL and `M7_VERCEL_CLI` to the authenticated CLI entry point. Run `node --import tsx scripts/check-m7-preview.ts`. It uses short-lived synthetic app sessions and Vercel authentication to check the responses, downloads and revocation, then deletes its test sessions.

## Physical acceptance and release

- Use a native test build configured with `EXPO_PUBLIC_API_BASE` for a device-accessible, isolated HTTPS test backend. The protected preview requires Vercel authentication in addition to app sign-in. A test build, its notification credentials and a consenting test inbox are prerequisites. Keep deployment-protection credentials out of distributed builds.
- Configure the consented verified address as `M7_TEST_EMAIL` on staging and enable the test delivery services. From a different tracker, let the recipient opt into invitations before an owner invites them. Verify exactly one email and push after a duplicate attempt. On web or phone, sign in and open the new tracker. Then enable mention delivery there. Post a shared comment explicitly naming the recipient, tap the notice from a closed app and again from the background, and verify the correct conversation and generic lock-screen text.
- Disable each channel independently and repeat with fresh events. To repeat an invitation, remove and re-invite the synthetic member. On the phone, background a signed-in viewer while another member removes their access. Resume, try the old notification and a cached screen, and confirm the financial data stays inaccessible. Record the platform, installed build, observed deliveries, disabled-channel result and revocation result.
- After those checks pass, coordinate the signed native build and server release. Take a fresh encrypted production backup, verify an isolated restore, check existing rows and balances across the release, and enable the household features only after compatible clients are available.
