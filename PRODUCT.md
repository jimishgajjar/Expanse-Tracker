# Product

## Register

product

## Users

Jimish and his partner: a two-person household tracking shared finances in a private workspace (the app supports multi-user workspaces with invites, but the core loop is personal). They check balances and log expenses from a phone in the moment (groceries, bills, transfers) and review the month on desktop. Fast capture and honest numbers matter more than features.

## Product Purpose

A single source of truth for household money: accounts, transactions, categories/tags, subscriptions and bills, budgets, savings goals, and split expenses, backed by one shared database across the web app and the native (Expo) app. Success = the user trusts the numbers at a glance and logging a transaction takes seconds.

## Brand Personality

Calm, precise, quietly confident. A premium ledger, not a fintech pitch deck. The 2026-07 direction: keep the calm foundations but show **more personality**, richer emerald data-viz moments, bolder figures and headers, more expressive use of the brand green at key moments (net position, positive deltas, primary actions). Personality lives in committed moments, never in ambient decoration.

## Anti-references

- Generic SaaS dashboard chrome: gradient hero metrics, glassmorphism-by-default, purple-on-dark AI aesthetics.
- Warm cream/parchment "AI default" backgrounds; this app is white paper / near-black ink.
- Cluttered banking-app density: ten widgets competing on one screen.
- A website squeezed onto a phone. The mobile web view must feel like an installed app (fixed tab bar, sheets, press feedback, safe areas).

## Design Principles

1. **Numbers first.** Money figures are the interface: tabular numerals, aligned columns, generous size for the figures that matter, muted chrome around them.
2. **Calm surfaces, committed moments.** Hairlines and white space by default; the emerald brand appears deliberately (primary action, active state, positive money, one hero moment per screen) and nowhere else.
3. **One-tap reachability on mobile.** Every core destination is one tap from the tab bar; capture (Add) is always visible.
4. **Same vocabulary everywhere.** One button shape, one form control set, one icon family (Lucide web / Feather native), the same semantic colors for in/out across web and native.
5. **Never lie about state.** Optimistic updates with undo, skeletons over spinners, empty states that teach.

## Accessibility & Inclusion

WCAG AA contrast for text; visible focus rings (`--ring` emerald); `prefers-reduced-motion` collapses all animation (already global); touch targets ≥44px on mobile; income/expense never encoded by green/red alone (signed amounts, +/− prefixes, and labels accompany color).
