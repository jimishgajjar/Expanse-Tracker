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
