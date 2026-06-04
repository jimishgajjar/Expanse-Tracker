# Money Tracker

A personal finance tracker — multiple accounts, richly categorised income & expenses (each with an icon and colour), separate income/expense views, charts, and a flexible **day / week / month / year / multi-year / all** time filter. Built to deploy on **Vercel** with **Neon Postgres**.

## Stack

| Layer     | Tech |
|-----------|------|
| Framework | Next.js 16 (App Router, React 19, TypeScript) + Server Actions |
| UI        | Tailwind CSS v4 + shadcn/ui (Base UI) + lucide icons |
| Charts    | Recharts |
| Database  | Postgres via Drizzle ORM — **Neon** in production, embedded **PGlite** for zero-setup local dev |

## Run locally (zero setup)

```bash
npm install
npm run dev          # → http://localhost:3000
```

With no `DATABASE_URL`, the app spins up an **embedded Postgres (PGlite)** in `./.pglite`, runs migrations, and seeds sample accounts, categories and transactions automatically — so it works immediately. Your data persists in that folder (git-ignored).

On first load you'll be asked to sign in. A demo account is seeded locally — **`demo@demo.com` / `password`** — or create your own.

> **Local dev speed (Windows):** if compiles feel slow, it's usually antivirus scanning `.next`. Add the project's `.next` folder to Windows Defender's exclusions, or keep the project on a fast local SSD — Vercel builds are unaffected.

## Use a real database (Neon)

1. Create a free Postgres database at <https://neon.tech> and copy its **pooled** connection string.
2. Copy the env template and paste it in:

   ```bash
   cp .env.example .env
   # DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require
   ```

3. Apply the schema and (optionally) seed defaults:

   ```bash
   npm run db:migrate          # create tables in Neon
   npm run db:seed             # default accounts + categories
   # npm run db:seed -- --samples   # also add example transactions
   ```

4. `npm run dev`. The same `DATABASE_URL` drives both local dev and production.

## Deploy to Vercel

1. Push this repo to GitHub and **Import** it at <https://vercel.com/new> (Next.js is auto-detected).
2. Add an Environment Variable **`DATABASE_URL`** = your Neon pooled connection string. (Optionally `APP_PASSWORD` to gate access, and `NEXT_PUBLIC_CURRENCY` / `NEXT_PUBLIC_LOCALE`.)
   - Tip: Vercel's **Neon** integration (Storage tab) can provision the database and set this for you.
3. Run migrations against the production database once — locally with the prod `DATABASE_URL`, via `npm run db:migrate`. Deploy.

## Features

- **Multiple accounts** — cash, bank, card, wallet, savings, investment; each with an icon, colour, opening balance, and a live computed balance.
- **Categories with icons** — separate income & expense categories, each with a pickable lucide icon and colour, fully manageable in a side panel.
- **Add / edit / delete** transactions, accounts and categories — all via Server Actions writing straight to Postgres.
- **Separate income & expense sections**, plus filters: by category, by account, free-text search, and a time-range selector spanning day → multi-year → all with prev/next navigation.
- **Tabbed views** — **Overview** (summary, all-accounts balances, charts), **Transactions** (filterable, paginated list), and **Analytics**, sharing one period selector.
- **Detailed Analytics** — totals, savings rate, averages, biggest expense, **net worth over time**, **period-over-period comparison** (▲/▼ vs last), the income-vs-expense trend, full category/account breakdowns, and **top merchants / largest transactions**.
- **Budgets** — set a monthly limit per expense category; progress bars warn when you go over.
- **Password gate (optional)** — set `APP_PASSWORD` to require a password before anyone can see your data.
- **Undo** — deleting a transaction shows an Undo toast to restore it (deletes are optimistic — the row vanishes instantly).
- **Account transfers** — move money between accounts (a 3rd type in the Add dialog) without affecting income/expense totals.
- **Recurring transactions** — schedule weekly/monthly/yearly rules that auto-create transactions on load.
- **CSV / Excel import** — bring data in via Settings → Data (accounts & categories created by name).
- **Account detail** — click any account card to see its stats and activity.
- **Tested** — `npm test` runs Vitest unit tests for the date-range, money, and bucketing logic.
- **Accounts & sharing** — email/password signup & login, change password, and forgot-password reset via email (Resend, or logged to the console in dev). **Invite people by email** to share access to all the data; the first user is the owner and only invited emails can sign up.
- **Pagination** — the transactions list is paginated with a **rows-per-page** selector (10 / 25 / 50 / 100).
- **Export to Excel** — one click downloads an `.xlsx` of all data (Transactions / Accounts / Categories sheets) via `/api/export`.
- **Currency setting** — change the display currency in-app (Settings ⚙); stored in the database and applied everywhere.
- **Fully responsive** — works phone → desktop: collapsing header, touch-friendly actions, stacking dialogs and grids; plus **dark mode**.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:generate` | Generate a Drizzle migration from the schema |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run db:push` | Push schema directly (prototyping) |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed default accounts + categories (`-- --samples` for demo data) |

## Project structure

```
src/
  app/
    page.tsx            dashboard (server component: reads range from the URL, fetches data)
    layout.tsx          fonts, theme provider, toaster
  components/
    dashboard.tsx       client shell: filter state + composition
    filter-bar.tsx      range + account/category/search filters
    summary-cards.tsx   KPI tiles
    category-donut.tsx  trend-chart.tsx   charts (Recharts)
    accounts-section.tsx  transactions-list.tsx
    account-dialog.tsx  transaction-dialog.tsx  category-manager.tsx
    icon-picker.tsx  color-picker.tsx  confirm-dialog.tsx  icon.tsx
    ui/                 shadcn/ui components
  lib/
    db/                 Drizzle schema, driver switch (Neon ↔ PGlite), seed
    actions.ts          server actions (CRUD)
    queries.ts          server-side reads + computed balances
    dates.ts  buckets.ts  format.ts  icons.ts  colors.ts
drizzle/                generated SQL migrations (committed)
```

## Notes

- The Notion connection from earlier iterations is gone — this version owns its data in Postgres. The previous Express/Notion app is preserved in git history.
- Database IDs/credentials live only in `DATABASE_URL` (server-side). `.env` is git-ignored.
