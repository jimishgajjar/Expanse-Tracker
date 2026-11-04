# M7: household access

This is the permission contract for the household milestone. Today financial entries belong to a **tracker**. All its current members can read its shared ledger. A person’s name on a transaction identifies who entered it, if recorded. It does not identify who paid, who owns the money, or who may see it.

| In the same tracker | Workspace owner | Editing member | Viewer | Former member / outsider |
| --- | --- | --- | --- | --- |
| Read a household entry and its history | Yes | Yes | Yes | No |
| Read comments on a household transaction | Yes | Yes | Yes | No |
| Post a comment on a household transaction | Yes | Yes | No | No |
| Remove a household comment | Any | Own only | No | No |
| Create, edit or delete a household entry | Yes | Yes | No | No |
| See the member list | Yes | Yes | Yes | No |
| See pending invitation addresses or manage invitations | Yes | No | No | No |
| Read your own personal entry (planned) | Yes | Yes | Yes | No |
| Edit your own personal entry or explicitly share it (planned) | Yes | Yes | No | No |
| Read, edit or share someone else’s personal entry (planned) | No | No | No | No |

Creating personal entries is available in the local web preview. “Owner” in the column heading means tracker administrator. Transferring tracker administration preserves each person's ownership of their private accounts.

- **Recorded by:** use the recorded creator; show “Not recorded” for unknown authors. An edit, import, matching note, workspace ownership or a split does not establish who originally entered or personally owns an item.
- **Belongs to:** current entries are household records for permission purposes, without an assigned individual owner. A future personal record requires an explicit person. Never backfill ownership or change the audience from names, accounts, creators or past edits.
- **Visible to:** current entries remain shared in their existing tracker. Future personal entries are visible only to their owner while that person is a member. Explicitly sharing a personal account must preview which history, balances and attachments would be exposed and require its owner's confirmation. The audience change does not by itself transfer ownership or grant someone else permission to re-share it.
- **Roles:** require an active, recognized membership in the resource’s workspace. Reject missing/unknown roles. Viewers cannot post changes even when they originally entered the item. Pending invitation addresses are administrative data, separate from a current member’s entry attribution.

## First local release

From **Activity → transaction menu → History & access**, current members can see the creator (when known), the tracker that holds the entry, its current audience and their own editing permission. The history lookup checks membership alongside the entry. Shared-entry edits and deletions also check the writer’s membership in the database statement.

The web and mobile member responses return pending invitation addresses only to the current tracker owner. If a selected tracker is removed or access ends, the session no longer defaults to another ledger. The user must choose an available tracker before posting again. These changes add no columns, reclassify no entries and do not migrate any data.

## Personal accounts in the local preview

The second M7 slice keeps a member’s personal accounts together in a separate ledger within their household. Each account and every dependent record (including a saved statement or import snapshot) lives in one ledger. The household view excludes personal balances **even for the person who owns them**; the personal view shows that person's ledger only. There is no combined total and no cross-ledger transfer. This boundary also prevents historical workbook sheets from accidentally joining personal details back into the household.

Migration 0023 adds the ownership mapping and membership guards. Existing records keep their original ledger. In the isolated preview, an editing member or owner can choose **Accounts → Open my private accounts**. The server uses the signed-in person's identity to open one empty ledger per household, or reopen the same ledger on subsequent visits. The person's private role follows their household role. A downgrade makes it read-only. Removal revokes access and re-admitting the same user restores access to the retained records. Invitations, ownership transfers, email, push and monthly digests are disabled for private ledgers.

**Repeatable local checks:** `npm test -- src/lib/__tests__/personal-ledger.test.ts` runs real route handlers against an in-memory household with two personal ledgers. `npm run rehearse:personal-backup` starts from a synthetic pre-M7 ledger, backs it up, applies the migration, adds personal records, compares the original records, and restores the encrypted backup. Neither command uses the live database.

The app's export links identify the tracker shown on screen. If another tab switches trackers before the download, the server refuses the export. Private downloads always require a tracker-specific link.

Web actions and app requests carry an identifier derived from the session, selected tracker and current membership role. A tracker switch or role change invalidates the old identifier. The web app conceals background tabs and verifies access before revealing them. The mobile app clears its financial cache, rejects outstanding responses and remounts screens after verifying access. Both clients recheck access every 15 seconds while active.

**Local evidence.** The tracker-view test uses separate authenticated browser and mobile sessions and a second household member to exercise the real handlers. The tracker-access test drives the mobile store through background, offline resume, revocation and sign-out.

**Account sharing in the web preview.** In a private account, choose **Manage account sharing**, select one current household member, review the account report and confirm. The owner can approve a new edition or stop sharing. A recipient opens **Accounts → Accounts shared with me** in the household tracker. Reports contain the approved opening and closing balances, dated transactions with notes and category names, and transfer amounts and directions. Receipt photos are opt-in. Only the approved photo can be served while the original is still available. Transfer counterparties, transfer notes, edit history, and unrelated records are excluded.

The server binds confirmation to the signed-in session, intended member, their current membership and the exact report. An approval expires after ten minutes. An updated copy replaces the previous edition for that recipient. Current membership and the stored grant are checked on every report and photo request. Removing either person removes the share, including after rejoining. Withdrawal clears the stored report and blocks old confirmations. Removing an account retires its copies. Previously saved copies cannot be recalled.

**Household reimbursements in the web preview.** Open **Shared expenses → Settle up** beside a member. Review the full outstanding balance between the two of you. Link a matching posted entry, record a single incoming or outgoing payment, or mark the IOUs paid outside the tracker. Choose a transfer when both accounts are tracked. An editing participant can reopen their settlement from **Settled reimbursements**. The IOUs reopen and the original payment stays available to link again. Historical settlements keep their existing status. Partial payments and settlement from private accounts are outside this preview.

**Transaction comments in the web preview.** Open an income or expense entry’s menu in Activity and select **Comments**. The audience shown above the editor is the audience of the original transaction. Private account reports exclude the conversation. Posts have an author and timestamp. Retrying a submission records it once. Removing a comment clears its text and attribution. Entries with active comments are protected from deletion, including through their parent account. Remove the comments explicitly before deleting the entry.

**Weekly household check-in in the web preview.** Open **Planning → Weekly household check-in**. Owners, members and viewers see balances from open household IOUs, including balances between other household members. Reciprocal IOUs offset within each pair. Upcoming bills use the next date on each active expense schedule from today through six days ahead. Variable amounts are marked as estimates. A past schedule date is flagged for review because the schedule alone cannot establish whether someone paid. Open goals use confirmed savings and appear in deadline order. Each list links to its source in Planning. Private ledgers and shared account reports are outside this review.

**Hosted release gate.** The embedded preview uses its own database. Hosted household operations use one PostgreSQL session per transaction. Staging requires `HOUSEHOLD_RELEASE=staging` and a dedicated Neon database named `m7_rehearsal_` followed by 32 hexadecimal characters. Hosted paths do not run migrations. Production requires its own explicit switch and a compatible app release. Earlier app versions lack the view identifier and receive an update-required response from protected routes. The dated [M7 rehearsal](m7-hosted-rehearsal.md) separates server results from phone and inbox acceptance.

**Personal delivery choices.** In **Settings → Reminders and digests**, each person can turn email and push on or off independently. Upcoming recurring items, posted entries, budget thresholds, monthly digests and comment mentions are specific to the selected household. Upcoming and posted notices also require alerts on the schedule. Budget alerts follow the 80% and 100% thresholds. Monthly digests cover the previous calendar month and respect the household digest switch. Email requires a verified address and push requires a registered device. The local preview exercises routing without contacting a provider.

**Tracker invitations** use the recipient’s account-wide preference, including when set from a private tracker. Each channel starts off. A verified account gains membership under the existing invitation rules. An address without a verified account stays pending. The owner can share the sign-up link directly. Verifying the invited address claims pending memberships. Sending the same invitation twice does not generate a second alert.

**Comment mentions** are available on shared transactions. The author selects up to ten other current members, including viewers, when posting. Typing a name does not notify anyone. Each recipient controls delivery for that household. Notification text excludes the comment, transaction, and financial details. The web link opens the conversation after the recipient signs in and selects the appropriate tracker.

Migration 0027 stores household opt-ins. Migration 0028 adds the mention topic, a separate table for account-wide invitation preferences and a table for explicitly named comment recipients. Existing accounts start with both new topics off. Removing a membership clears its household preferences and mention records. Rejoining retains the account-wide invitation choice.

Apply the same audience restriction **before** searching, counting, totaling or paging rows. Cover account/transaction details and history; allocations, transfers and refunds on both sides; search and category/tag views; Overview, forecasts and reports; imports, exports and receipt bytes; mobile APIs and on-device caches. Background reminders, digests and mentions need the recipient's current access at send time. A shared total or transfer label must not reveal a hidden account. Block mixed-audience links until their disclosure rules are implemented.

Test with two editing members, a viewer and a second workspace. Check downgrade, removal, transfer of workspace ownership, direct-ID requests and data already cached in a second client. Revocation applies to future access. Copies previously exported cannot be recalled.
