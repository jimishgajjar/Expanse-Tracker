# Project review and redesign proposal

Reviewed 15 September 2026. Proposal only; application implementation unchanged.

Method: dual-agent (A: `/root/design_review`, independent design assessment; B: `/root/ui_evidence`, independent detector evidence), followed by parent source review, checks, and desktop/tablet/mobile browser inspection. Scores are expert judgments, not user-study results or an accessibility certification.

## Recommendation

Keep the existing Next.js/React/Drizzle architecture and modernize the application around three household tasks: understand our position, record a transaction quickly, and see what needs attention. The white/ink/emerald identity already fits the product. The largest improvement will come from navigation, prioritization, mobile capture, and dependable numbers.

This is already a substantial product: accounts and transfers; income and expenses; categories and tags; budgets; recurring subscriptions, installments and variable bills; savings goals; shared expenses and settlements; analytics; CSV/Excel import/export; workspace roles; email and push notifications; an installable web application; and a mobile API. Preserve these capabilities during redesign. Native app screens were not evaluated.

## Findings and checks

- Existing test suite: **19 passing tests across 3 files**. Coverage includes core calculations and selected workspace-isolation cases; it does not establish complete isolation or recurrence concurrency safety.
- Application-source ESLint: **5 errors, 2 warnings**. Errors occur in account/category/tag detail pagination effects, notification initialization, and donut-chart render logic. These are existing rule violations, not proof each produces a visible defect.
- Repository-wide ESLint: **12 errors, 311 warnings**, including local agent tooling and utility files. Tighten lint scope so application results are actionable.
- TypeScript check fails with TS2322 errors in the existing, git-ignored `scripts/copy-neon-to-local.ts`. Its inclusion follows the broad `**/*.ts` configuration. Separate one-off utility scripts from the app type-check boundary or fix the script. Do not claim the tracked application itself fails for these reasons.
- No production build or performance benchmark was run. Development compilation was slow; do not extrapolate its timing to production.
- Browser inspected the seeded demo using a separate temporary PGlite database, with external database access and email/push credentials disabled for that process. Reviewed overview at desktop, 768px tablet, and 390px phone widths, plus mobile transaction entry and Insights.
- At **768px viewport width, document width is 854px**. The tablet view has horizontal scrolling, cramped/wrapped header actions, and clipped period controls.
- Transaction form accessibility tree exposes unnamed amount/date/account/category controls despite visible labels. Dashboard has no `main` landmark; mobile removes the only h1.
- Detector scanned 71 component files and returned two `design-system-color` advisories: `account-dialog.tsx:32` (`#6366f1`) and `goals-manager.tsx:67` (`#047857`). They are entity-color defaults, not evidence of widespread palette failure. No definite false positives. Valid JSON was returned with exit code 1, rather than the playbook's documented finding code 2.

## Design health

| Heuristic | Score /4 | Main observation |
|---|---:|---|
| Visibility of system status | 3 | Saving states, toasts and result counts exist; field errors need context. |
| Match with real-world language | 3 | Familiar financial vocabulary; some analytics labels need explanation. |
| User control and freedom | 3 | Cancel, clear filters and delete Undo exist; drafts can be lost. |
| Consistency and standards | 2 | Shared primitives, but navigation names and interaction patterns vary. |
| Error prevention | 2 | Validation exists; more errors could be prevented before submission. |
| Recognition rather than recall | 2 | Planning and household tools are scattered through dialogs. |
| Flexibility and efficiency | 2 | Search/filter/import exist; capture shortcuts and bulk actions could help. |
| Aesthetic and minimalist design | 2 | Coherent palette; crowded controls and equal-weight analytics compete. |
| Error recovery | 2 | Toast feedback lacks field-specific guidance. |
| Help and documentation | 2 | Useful empty states; limited contextual explanation for financial concepts. |
| **Total** | **23/40** | **Acceptable foundation with significant opportunities.** |

## Design priorities

### 1. P1 — Fix responsive navigation and capture accessibility

The header switches to desktop controls at 640px, although five management destinations, three capture options and three utility buttons need more room (`src/components/dashboard.tsx:180`, `:197`). Its fixed-height container and wrapping actions collide at tablet widths. Use full desktop navigation only when it fits, a compact drawer in the middle range, and the existing mobile bottom navigation on phones. Make the period selector adapt separately.

Transaction edit/delete buttons resolve to 24px (`src/components/ui/button.tsx:29`, `src/components/transactions-list.tsx:164`). Establish 44–48px mobile hit areas, 16px mobile input text, persistent associated labels, selected-state semantics, and inline errors. Add a `main` landmark and an accessible page title at every breakpoint. Use proper tab panels or route links to match the chosen navigation model.

Suggested skill commands for later implementation: `impeccable adapt`, `impeccable harden`.

### 2. P2 — Make the overview answer a household question

The balance is clear, but account cards repeat Income/Expense/Transfer actions and push interpretation further down the screen. There is no recent-activity block on Overview (`src/components/overview-tab.tsx`). Retain contextual account shortcuts in an account menu or detail page, while providing one prominent global Add transaction action.

Show current total balance separately from period-based income, spending and net. Add recent activity and a small actionable list drawn from existing data: bills coming due, budgets close to their limit, and unsettled shared expenses. Every item should lead to the corresponding detail/action. Clearly distinguish current-month budgets and full-year patterns from the chosen period.

Suggested commands: `impeccable shape`, `impeccable layout`.

### 3. P2 — Reduce friction in transaction entry and activity

Use a desktop dialog and mobile bottom sheet with a large amount field, expense/income/transfer selector, account, category and date. Collapse optional tags/notes behind Details when useful. Keep every field and retain edit, delete and Undo. Persist an interrupted draft safely and scope any remembered defaults to the workspace.

The current All activity view excludes transfers (`src/components/transactions-tab.tsx:95`, `:199`). Make it a genuine chronological money-movement feed, or rename its scope explicitly. Preserve separate transfer totals so moving money does not count as income or spending.

Suggested commands: `impeccable clarify`, `impeccable harden`.

### 4. P2 — Make Insights easier to interpret

Insights Summary begins with eight similarly prominent statistics and follows with numerous charts and lists (`src/components/analytics-tab.tsx:191`). Lead with the period outcome, then one primary trend, budget exceptions and category changes. Keep the detailed Trends, Budgets, Commitments and Patterns views accessible. Explain percentage comparisons, especially a zero baseline, and avoid treating note text as a reliably normalized merchant identity.

Suggested commands: `impeccable distill`, `impeccable clarify`.

### 5. P2 — Clarify Settings save boundaries

The dialog combines currency settings with independently committed imports, notifications, password changes and account actions, then ends with Save/Cancel (`src/components/settings-dialog.tsx:39`, `:70`, `:92`). Use explicit sections and localized save buttons such as Save currency. Immediately applied actions should say so; closing the dialog should not imply those changes are undone.

Suggested command: `impeccable clarify`.

## Proposed modern design

Direction: **a calm, modern household ledger**. White/light-neutral surfaces, near-black text, restrained emerald, clear money typography, comfortable spacing, and purposeful motion. Retain dark mode, semantic signs and category colors. Use a consistent radius around 8–12px for controls/panels where helpful, without boxing every statistic. Treat these as proposed changes to DESIGN.md, not changes already made.

- Typography: retain Inter; use a decisive 36–44px primary balance on desktop, 30–36px on mobile, 14–16px body copy and 12–13px supporting text. Align amounts with tabular numerals.
- Layout: compact desktop sidebar, quiet workspace header, readable content width, consistent 8px spacing rhythm. Tablet uses a drawer when the sidebar would squeeze content.
- Color: emerald for primary actions and active states; positive/negative amounts also carry signs and labels. Avoid large decorative tinted panels competing with financial information.
- Interaction: 120–180ms feedback, reduced-motion support, visible keyboard focus, clear saving/error/empty states. Confirm chart contrast in both themes before shipping.

Suggested desktop structure:

```text
Navigation          Workspace / Overview        Period     + Add transaction

Overview            Current total balance
Activity            Income      Spending        Net this period
Accounts
                    Cash-flow trend             Needs attention
Planning            Recent activity             Budget status
  Budgets                                       Upcoming bills
  Bills & recurring
  Goals

Insights
Household
  Shared expenses
  Members

Settings
```

Mobile: retain **Home / Activity / Add / Insights / More**. Home begins with the balance and period outcome, then concise attention items and recent activity. Account details and Planning remain easy to reach through More and contextual links. All existing recurring settings, installments, variable bills, savings contributions, settlements, roles, category/tag management, imports, exports and notifications remain available.

## Reliability and security priorities

These are source-backed findings and risks, not results of a production penetration test.

| Priority | Finding | Evidence and recommended change |
|---|---|---|
| P1 | Related record IDs are not consistently validated against the active workspace. | `src/lib/actions.ts:133` trusts submitted account/category/tag IDs. `setBudget` at `:204` upserts by category ID alone, without establishing ownership of that category. The schema's foreign keys do not include workspace identity. Validate related IDs and membership before writes; scope conflict updates; add adversarial cross-workspace reference tests. |
| P1 | Recurring entries can be duplicated under concurrent processing or partial failure. | `src/lib/queries.ts:169` inserts transactions and separately advances the rule at `:170`; both page loads and cron invoke the engine. Use a unique rule/occurrence identity with an atomic claim/commit strategy supported by the production database driver. Test concurrent execution and retry after interrupted writes. |
| P1 | Mobile login omits the web login throttle. | `src/app/api/mobile/auth/login/route.ts:14` does not invoke `rateLimit`, whereas `src/lib/auth.ts:63` does. Share the authentication service and throttle policy across both entry points. |
| P1 | Password reset/change leaves existing sessions valid. | `src/lib/reset.ts:56`, `src/lib/auth.ts:87`, and the mobile password-change endpoint update the hash without revoking sessions. Revoke other sessions and invalidate outstanding reset tokens as part of recovery. |
| P1 | Cron fails open when its secret is unset and masks processing errors. | `src/app/api/cron/recurring/route.ts:11` only checks authorization when a secret exists; catches turn failures into zero counts followed by `ok: true`. Require configuration in production and report failures for monitoring/retry. Production secret configuration was not inspected. |
| P2 | Login trusts an unvalidated return URL. | `src/lib/auth.ts:70` passes `next` directly to `redirect`. Accept only validated same-origin local destinations. |
| P2 | Import can duplicate data and partly apply changes. | `src/lib/import-action.ts` immediately creates missing entities, then inserts the transaction batch. Add preview/mapping, robust CSV parsing including quoted newlines, date/amount validation, duplicate detection, limits, and an atomic import boundary or recoverable import batch. |

Authentication recommendations align with [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) and [password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Architecture and performance

The root page loads data for all tabs and management dialogs before handing it to one large client dashboard (`src/app/page.tsx:80`). Transactions are fetched for the entire period (`src/lib/queries.ts:326`), then paginated with client-side slicing. All-time views will grow in cost with the dataset.

Introduce route-level or independently loaded feature surfaces, server-side filtering/pagination, and demand-loaded management dialogs. Preserve workspace authorization and fresh balances; do not add broad shared caching around user data. Keep the existing parallel queries where they help and measure before optimizing further. [Next.js lazy-loading guidance](https://nextjs.org/docs/app/guides/lazy-loading) supports deferring optional client code; deferring its database queries requires an explicit data-loading change as well.

Share validation and domain services between Server Actions and the mobile API to avoid authentication/behavior drift. Add targeted end-to-end checks for capture/edit/delete/Undo, transfers, viewer restrictions, workspace switching and imports. Add recurrence concurrency/retry tests and cross-workspace foreign-reference tests before relying on existing isolation coverage.

## Feature improvements after the foundations

1. **Reconciliation:** compare a tracked account with a statement balance and mark entries reconciled; surface discrepancies.
2. **Reliable import workflow:** preview, map columns, flag duplicate rows, show per-row errors, and track an import batch for review or reversal.
3. **Faster repeat entry:** transaction templates, recently used categories/accounts, duplicate-entry action, keyboard shortcuts and saved filters.
4. **Household activity history:** show who changed an entry and when, with an appropriate retention and recovery design.
5. **Offline draft capture:** queue explicitly marked local drafts and safely retry with deduplication. The current service worker handles notifications and does not provide an offline transaction queue.
6. **Estimated cash-flow forecast:** combine scheduled income, recurring costs and current balances; expose assumptions and variable-bill estimates. Do not present an estimate as guaranteed available money.

Receipt attachments/OCR, bank synchronization and per-account foreign currencies are later candidates. They require storage/privacy, duplicate handling or exchange-rate semantics beyond a visual redesign. Currency selection currently formats the workspace; it is not a full currency-conversion ledger.

## Delivery order and acceptance criteria

1. **Trust and quality:** workspace-reference guards, recurrence idempotency, auth/session/cron fixes, clear app lint/type-check boundaries and focused regression tests.
2. **Design foundation:** approve navigation and overview composition; revise tokens and reusable controls; validate desktop/tablet/mobile and dark mode.
3. **Core workflows:** migrate overview, activity, account detail and capture; preserve every field, action, role and return path.
4. **Planning and household:** budgets, bills, goals, splits, members and settings, with explicit save boundaries and deep links.
5. **Product additions:** reconciliation, import improvements, templates, history and offline drafts in that order unless usage evidence suggests otherwise.

Acceptance: no page-level horizontal scrolling at 390/768/1280px; main/title landmarks; labeled keyboard-operable fields and charts; comfortable touch targets; stable totals across transfers; no duplicate recurring posting on retries; workspace boundaries enforced on related IDs; no removed capabilities; and successful core workflows for owner, editor and viewer roles. Large-data performance should be measured against a representative ledger before release.

## User perspectives and open design decisions

- Distracted phone user: needs one-thumb entry, larger targets and a preserved draft when interrupted.
- Screen-reader/keyboard user: needs associated labels, announced type selection, headings and consistent focus recovery.
- Household reviewer: needs a clear outcome and exceptions before eight comparable metrics; should see transfers in All activity.

The intended emotional path is confidence in the balance, low effort at entry, and understanding at review. Current friction concentrates in navigation, capture and dense Insights. Preserve the strong ledger identity and Undo behavior.

Two decisions for a later design pass: should Home prioritize current position or monthly attention items, and should the first release focus only on reorganizing existing features or also add reconciliation/import improvements? Recommended defaults are current position plus a small attention list, and existing-feature redesign first.
