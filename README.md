# Full-Stack Mastery Tracker

A self-hosted learning dashboard for the full-stack path (Foundations → Frontend → Angular → Java → Spring Boot → Databases → REST & GraphQL → Testing → Security → DevOps → System Design → Career → Capstones).

- **Track progress** by checking off lessons. A live study plan estimates your finish date from a daily pace.
- **Sync to Notion** — your completed lessons become rows in a Notion database you own, so progress follows you across devices and you can view/sort it natively in Notion.
- **AI tutor** — every lesson has an "Ask AI" panel powered by Claude, with quick prompts (explain, example, quiz, gotchas) and streaming answers.
- **Works immediately** — runs on browser `localStorage` out of the box; Notion and the AI key are optional add-ons that light up when configured.

## Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | Vanilla HTML/CSS/JS (ES modules), no build step |
| Backend   | Node + Express |
| Database  | Notion (via `@notionhq/client`) |
| AI        | Anthropic Claude (`@anthropic-ai/sdk`), streamed through the backend |

## Quick start

```bash
npm install
cp .env.example .env      # optional — see below
npm start                 # → http://localhost:3000
```

With no `.env`, the app runs fully on browser storage and lets each user paste their own Anthropic key for the tutor. Add config to enable sync and a shared key.

## Enabling Notion sync

The backend talks to Notion with an **internal integration token** (the browser can't call Notion directly — CORS). One-time setup:

1. Create an integration at <https://www.notion.so/my-integrations> → copy its token (`ntn_…`).
2. In Notion, open (or create) a page to hold the data, click **•••  → Connections → Connect to** your integration.
3. Copy that page's ID from its URL (the 32-char hex string).
4. Fill in `.env`:

   ```ini
   NOTION_TOKEN=ntn_xxxxxxxx
   NOTION_PARENT_PAGE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

5. `npm start`. On first run the app creates a **"Full-Stack Mastery — Progress"** database under that page and remembers its ID in `.notion-db.json`. The console prints `Notion sync: ON`.

Already have a database? Set `NOTION_DATABASE_ID` instead of `NOTION_PARENT_PAGE_ID` (share it with the integration first). The schema it expects: `Lesson` (title), `Lesson ID` (text), `Phase` (select), `Track` (select), `Module` (text), `Hours` (number), `Done` (checkbox), `Completed At` (date).

> Daily-pace preference stays in the browser; completed lessons are what sync to Notion.

## Enabling the AI tutor

The tutor proxies to Claude through the backend (keeps the key off the wire to Anthropic, avoids browser CORS). Two options:

- **Per-user key (default):** leave `ANTHROPIC_API_KEY` blank. Each user pastes their own key in the first AI panel they open; it's stored in their browser's `localStorage` and sent to your server per request.
- **Shared server key:** set `ANTHROPIC_API_KEY` in `.env` and nobody has to paste anything.

Model defaults to `claude-opus-4-8`. To trade quality for cost, set `AI_MODEL=claude-haiku-4-5` (or `claude-sonnet-4-6`).

## Scripts

- `npm start` — run the server
- `npm run dev` — run with `node --watch` (auto-restart on file changes)

## Project layout

```
server/
  index.js     Express app: API routes + static serving
  notion.js    Notion data access (create db, read/upsert/reset progress)
  ai.js        Claude proxy (streaming + prompt caching)
public/
  index.html   shell
  styles.css   styling (from the original design)
  data.js      the full curriculum
  app.js       rendering, progress, study plan, search, AI panel
```
