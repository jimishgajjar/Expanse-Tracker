# Expense Tracker design system

## Direction

A calm household finance workspace: clear balances, useful context, and quick access to every existing tool. The signed-in application uses a persistent sidebar on desktop and a labeled bottom navigation on phones and tablets. Marketing pages retain their existing composition.

## Structure

- Overview: current total balance, period income/spending/net, trend, recent transactions, budget warnings, upcoming payments, accounts, category breakdown.
- Activity: one dated feed for expenses, income, and transfers; existing search, filters, pagination, edit, delete, and undo.
- Accounts: balances, account history, creation, editing, archiving/restoring, and contextual transaction entry.
- Planning: budgets, subscriptions/bills, savings goals, and shared expenses.
- Insights: existing reports, grouped under readable summaries and progressive disclosure.
- Workspace tools: categories, recurring rules, goals, shared expenses, members, settings, and export remain accessible.

At 1024px and wider the sidebar is 240px and scrolls independently on short screens. Below that, Home / Activity / Add / Insights / More remains reachable at the bottom. More includes Accounts and Planning. Content is capped at 1440px with 16–40px gutters.

## Tokens

| Purpose | Light | Dark |
| --- | --- | --- |
| App canvas | #f6f8f7 | #171b19 |
| Surface | #ffffff | #202020 |
| Main ink | #25342e | #d3d3d3 |
| Secondary ink | #65716b | #9b9a97 |
| Brand | #0f7b6c | #2f9e89 |
| Positive | #0f7b6c | #4dab9a |
| Negative | #bf3e38 | #ff7369 |

Inter remains the primary typeface. Use tabular numerals for amounts, a single prominent balance, 28–32px page titles, 14px body copy, and 12px secondary labels. Use a 10px base radius, 8px controls, and 13–17px major surfaces. Reserve shadows for overlays; use spacing and thin borders for content structure.

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

Cash-flow charts offer labeled axes, keyboard and touch selection, and exact amounts in a persistent detail area. Category legends link to full category history. Empty charts explain how to populate them. Account, transaction, and settings forms share spacing, touch targets, inline errors, and mobile sheets. Budget changes require an explicit Save or Remove action; invalid numbers never remove an existing limit.
