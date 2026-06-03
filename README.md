# Notion Money Tracker

A self-hosted money tracker that uses **your own Notion databases as the backend**. The Notion key lives only on the server (in an environment variable) — the browser never sees it. Incomes, expenses, accounts and categories are read from and written straight back to Notion.

Runs out of the box: with no configuration it starts in a **browser-local demo mode** so you can try it immediately; add a Notion token to sync real data.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | Vanilla HTML/CSS/JS (ES modules), no build step |
| Backend  | Node + Express |
| Database | Notion (via `@notionhq/client` v5) |

## Quick start

```bash
npm install
cp .env.example .env      # optional — see below
npm start                 # → http://localhost:3000
```

With no `.env`, the app runs entirely in the browser on `localStorage`, seeded with sample data. Add Notion config to switch to real, synced data.

## Enabling Notion sync

The browser can't call Notion directly (CORS + secret safety), so the server holds an **internal integration token**.

1. Create an integration at <https://www.notion.so/my-integrations> and copy its token (`ntn_…` or `secret_…`).
2. **Share your databases with it** — the step everyone misses. Open your **💰 Money Trackers** page in Notion → top-right **•••** → **Connections → Add connection →** your integration. Sharing the parent page grants access to the child databases (Incomes, Expenses, Accounts, Categories).
3. Put the token in `.env`:

   ```ini
   NOTION_TOKEN=ntn_xxxxxxxx
   ```

4. `npm start`. The console prints `Notion: ON`. If a database can't be reached, the app logs why and falls back to local mode.

The five database IDs and the property names live in [`server/config.js`](server/config.js) (IDs aren't secrets). They default to the bundled template; override any of them with `DB_EXPENSES`, `DB_INCOMES`, `DB_ACCOUNTS`, `DB_EXPENSE_CATEGORIES`, `DB_INCOME_CATEGORIES` env vars if your databases differ.

## Optional: lock the app

For a deployed instance, set `APP_TOKEN` to any long random string:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

The browser then asks for it once (stored locally) and sends it on every API call; unauthenticated requests get `401`. On localhost you can leave it blank.

## What it does

- **Summary** — total balance across accounts, plus income / expenses / net for the selected month.
- **Account cards** — live balance per account (income in − expenses out).
- **Add transactions** — expense or income, with categories created on the fly; written to Notion.
- **Charts** — spending-by-category (or income-by-source) donut with a legend, following the type filter.
- **History** — transactions grouped by day, filterable by month / type / free-text search, with delete.

> Editing an existing transaction is "delete + add" for now — the Notion relations make in-place edits fiddly. Easy to extend with a `PATCH /api/transactions/:id` route later.

## Scripts

- `npm start` — run the server
- `npm run dev` — run with `node --watch` (auto-restart on changes)

## Project layout

```
server/
  config.js    Notion database IDs + property names (+ colour palette)
  notion.js    Notion data access (read all, add, archive) via SDK v5 data sources
  index.js     Express app: API routes + optional auth + static serving
public/
  index.html   shell
  styles.css   styling
  app.js        data layer (API or local), rendering, charts, add/delete, filters
```

## Currency

The display symbol defaults to `₹`. Change the `CURRENCY` constant at the top of [`public/app.js`](public/app.js) to `$`, `€`, `£`, etc.

## Security notes

- The Notion token only ever lives in the **server's** environment — never in the repo or the browser bundle. `.env` is git-ignored.
- `APP_TOKEN` is a shared password gating the API; fine for a personal app. For multiple users, swap in real auth later.
- Database IDs are not secret; the integration token is what grants access.
