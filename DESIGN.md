# Expense Tracker design system

## Direction

A calm household finance workspace: clear balances, useful context, and quick access to every existing tool. The signed-in application uses a persistent sidebar on desktop and a labeled bottom navigation on phones and tablets. Marketing and sign-in pages share the engraving-green ground and display type.

## Structure

- Overview: current total balance, period income/spending/net, trend, recent transactions, budget warnings, upcoming payments, accounts, category breakdown.
- Activity: one dated feed for expenses, income, and transfers; existing search, filters, pagination, edit, delete, and undo.
- Accounts: balances, account history, creation, editing, archiving/restoring, and contextual transaction entry.
- Planning: budgets, subscriptions/bills, savings goals, and shared expenses.
- Insights: existing reports, grouped under readable summaries and progressive disclosure.
- Workspace tools: categories, recurring rules, goals, shared expenses, members, settings, and export remain accessible.

At 1024px and wider the sidebar is 240px and scrolls independently on short screens. Below that, Home / Activity / Add / Insights / More remains reachable at the bottom. More includes Accounts and Planning. Content is capped at 1440px with 16–40px gutters.

## Tokens ("Intaglio")

The identity borrows from the inks of a cheque or banknote: cool green-white paper, deep engraving green, a seal red for money going out, and brass used only for engraved line work.

| Purpose | Light | Dark |
| --- | --- | --- |
| Paper (canvas) | #f3f6f4 | #0a1512 |
| Surface | #ffffff | #0f1f1a |
| Ink | #10261f | #e4eee8 |
| Secondary ink | #56685f | #96aaa0 |
| Brand / positive | #0d6e55 | #4fbf98 |
| Engraving green (dark grounds) | #0b3d31 | #0e3a2f |
| Seal red (negative) | #b23a2e | #ef8a7d |
| Brass (line work only) | #a87a2f | #d6a95e |

Type: IBM Plex Sans for the interface, with tabular figures in every money column. Source Serif 4 (`font-display`, `.display-figure`) only for page titles (every `.app-shell h1`), the headline balance, and marketing headlines; panel and section headings stay in Plex. 8px base radius. Reserve shadows for overlays and the landing ledger page.

The one signature element is the guilloché (`components/guilloche.tsx`): a band of engraved sine lines across the top of the engraving-green balance panels, like a cheque border, and along the foot of the landing and sign-in grounds. Do not use it elsewhere. The brand mark (`components/brand-mark.tsx`) is a seal with the double rule drawn under a final total.

Landing: one engraving-green hero with a ruled ledger page (red margin rule, a transfer row marked as not spending, Spent and Kept at the foot), then quiet paper sections set in type. Marketing copy makes only claims the product supports: no encryption or speed claims.

## Interaction

- Mobile controls have 44px minimum touch targets; inputs are 16px to prevent browser zoom.
- Inputs have associated labels. Focus rings and a skip link support keyboard navigation.
- Transaction entry is a bottom sheet on phones and a dialog on larger screens. Amount, date, account, and category come first; notes and tags are optional details.
- An unsaved new transaction draft persists while its trigger remains mounted. It is cleared after a successful save, workspace change, or leaving the page.
- Errors stay beside the form; success uses existing toasts and refresh behavior.
- Viewer roles can read the app without being offered mutation controls.
- Current balance is explicitly distinguished from selected-period cash flow. Transfers do not count as spending or income.
- Motion is brief and functional; honor reduced-motion preferences.

## Guardrails

No decorative financial claims, charts without context, hidden primary actions, or horizontal page overflow. Preserve the existing routes, data contracts, currency formatting, and feature access. A visual redesign must not require a database migration or rewrite historical entries.

## Detail pages

Account, category, and tag detail pages use the same workspace canvas, navigation, typography, and surfaces as Overview. Account rows on Overview link directly to their detail pages. Desktop detail navigation offers direct account switching; mobile retains the five primary destinations.

Account balances and all-time summaries remain independent of activity filters. Activity supports income, expense, transfer, search, category, inclusive date and amount ranges, transfer direction, and date/amount sorting. Category and tag histories also support account filtering. Filtered income and expense totals exclude transfers. Existing edit, delete, and undo controls remain available according to workspace permissions.

Overview places the full Accounts card grid directly after the balance summary, before charts and recent activity. It shares AccountsSection with the Accounts page, including direct detail links, transaction shortcuts, account management, and archived-account access.

Below accounts, Recent transactions sits on the left and On your radar on the right. A separate chart row places Income vs expense on the left and Spending by category on the right. On narrower screens each row stacks in DOM order. Category chart content adapts to its own container width. The radar panel separates budget alerts from scheduled payments, with calendar dates, relative due labels, clear amounts, and explicit estimates for manual entries.

Account cards keep income, expense, and transfer shortcuts visible; account management lives in a labeled More menu. Transaction rows use signed, aligned amounts with directional icons, wrapping notes, account links, and touch-accessible action menus. Active filters appear as individually removable chips. Global date shortcuts change the selected reporting period; detail date shortcuts filter the full account/category/tag history.

The Accounts section separates its title and active count from the combined balance. Individual account cards use rounded surfaces, larger account icons, wrapping names, an explicit current-balance label, and a navigation chevron. Income, expense, and transfer remain separate 44px touch targets in a softly tinted footer.

Workspace tools use a shared slide-out ManagerPanel: up to 576px wide on desktop, full width on mobile, with a fixed icon/title header, one scrolling content area, and a persistent Done action. Categories, subscriptions, goals, shared expenses, members, and settings share this layout. Creation forms expand in place, opening initially when a list is empty; lists remain easy to scan. Settings separates display, data, notifications, and security into labeled sections. Existing mutation permissions and confirmation dialogs remain in force.

Cash-flow charts offer labeled axes, keyboard and touch selection, and exact amounts in a persistent detail area. Category legends link to full category history. Empty charts explain how to populate them. Account, transaction, and settings forms share spacing, touch targets, inline errors, and mobile sheets. Budget changes require an explicit Save or Remove action; invalid numbers never remove an existing limit.

## Compact workspace density
Use a compact finance-terminal rhythm inspired by the requested Groww reference: 24px page headings, 14px section headings, 12px secondary labels, 16px section gaps and padding. Desktop navigation uses a 208px rail; tool sheets are 480px with 36px pointer controls. Touch controls remain 44px. Account links and all actions remain visible; charts stay side by side on wide screens. Mobile cash-flow totals use full-width rows to keep long currency amounts intact.

## October dashboard refinement

The current dashboard keeps the established fixed 240px desktop sidebar. Use a flat neutral canvas, restrained emerald accents, 24px page titles, and 14px section titles. Avoid decorative gradients, duplicated balances, and status badges that do not convey state.

The overview starts with one financial summary: current balance on the left and selected-period income, expenses, and net cash flow on the right at laptop widths. On phones, cash-flow values become aligned rows. Clearly distinguish current balance from period totals; transfers remain excluded from cash flow. Show prior-period comparisons only when the comparison is meaningful.

Accounts follow immediately with direct history links and visible income, expense, and transfer actions. Phone cards put account identity and balance on the same row while retaining 44px action targets. Recent activity and the planning radar share the next row; income versus expense and category breakdown share the row below. Use subtle 12px surface corners and hairline dividers. Match paired panel heights and keep all chart navigation and category links available.

These are presentation changes only. Preserve existing database contracts, balance calculations, permissions, and mutation confirmations. Use the isolated local preview database for validation; no live-data migration is required.

## November internal-page polish

Standalone tool pages (Debt & currencies, imports, exports, setup, help, feedback, shared accounts, account sharing) use the shared `PageShell`: a slim sticky bar with the brand mark and one back link, then a centred column (narrow 672px, default 768px, wide 1024px) with an optional eyebrow, a 24px title and a one-line description. Sections use `dashboard-panel page-section`; inline links use `.text-link`; two-to-five-way switches use `.segmented`.

No decorative colour stripes: account cards and the balance summary rely on hairlines and icon tint, not 3px coloured borders. No status pills that do not report state. Navigation marks the active item with a tinted background and a brand-coloured icon only. Stored ISO dates are shown as "24 Nov" (year added only when it differs) through `shortDay`. The debt-and-currency summary appears as a full panel only after it is configured; before that, Overview shows a single dashed invitation row.

## Household shortcuts (November)

- **Card statements and categories.** Imports accept credit-card statements (purchases positive). Rows without a category get the one this household used before for the same description or merchant (first two words, letters only), marked "suggested from your history". Payments on the card carry a notice to record them as a transfer. When a "Credit card bill" style category is 10% or more of a period's spending, Overview and Insights show a dismissible explanation with links to import a statement or add a card account. None of this edits existing entries.
- **Budget and goal starting points.** The budget panel shows each category's three-month average and highest month, with a "Use" button that fills (never saves) a tidy rounded limit. The goal form offers sinking-fund ideas (car costs, emergency, family support, annual bills, travel) that fill the name and a target date.
- **Customisable Overview.** Each person can show, hide and reorder Overview sections (balance, accounts, planning, activity, charts). The arrangement is kept per person and per device in browser storage; at least one section stays visible.
- **Quick add.** New-entry forms show up to six repeat entries (same description, account and category at least twice in 120 days). Picking one fills the form and selects the amount for adjustment; Save is still required.
- **Offline capture and install.** A new expense or income saved while offline is kept on that device and sent with its original request id when the connection returns (the server's receipt prevents duplicates). An "entries saved on this device" panel lists anything waiting. The service worker caches only a static offline page, never financial pages or API responses. "Install app" appears where the browser supports it, with Share → Add to Home Screen steps on iPhone.

## Financial summary header (November)

Overview opens with a statement-style header. Left: one deep-emerald panel (`--brand-deep`) with the current balance and a sparkline of cumulative net cash flow for the selected period, the screen's single committed colour moment. Right: three KPI tiles (Income, Expenses, Net cash flow), each with the figure, a change against the prior period coloured by whether it is good for the household (higher spending is red), and twelve mini bars; below them a savings-rate strip with a progress bar and a plain-language sentence. All figures come from the same period entries as before; transfers stay excluded from cash flow.

## Correcting entries that were really transfers

Activity rows offer "Not really spending…" / "Not really income…". The dialog turns the entry into a transfer between the household's own accounts and, when the matching opposite entry on the other account is found (same amount, within a week), removes that too. An income can instead be folded into its account's starting balance. Both are single atomic statements that keep every account balance unchanged; the removed entries stay in edit history with a pointer to the new transfer. Entries with receipts, comments, refund links or reimbursements must be cleared first.

## Consistent headers

Account and category detail pages reuse the Overview's deep-emerald balance panel (account: running-balance sparkline; category: the total tile). Insights' view switcher uses the shared `.segmented` control. The Overview layout is stored per person in `user_preferences` (migration 0034) and mirrored in browser storage for instant loads; without the table it stays per device.

## Tools are pages, not drawers

Categories, Subscriptions & bills, Savings goals, Shared expenses and Members & sharing are dashboard pages (`?tab=categories|recurring|goals|split|members`) with the normal page title. `ManagerPanel` renders inline inside `<ManagerPage>`. Everywhere else (receipts, refund links, statement checks, budgets, the Overview layout) it opens as a centred window, which becomes a bottom sheet on phones. Nothing slides in from the side. On phones, More (`?tab=more`) is a page listing every destination.

