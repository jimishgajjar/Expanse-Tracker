// Point-in-time backup of the tracker's database.
//
// READ-ONLY: issues SELECTs only and never writes back. Output goes to
// backups/backup-<timestamp>/ as one JSON per table plus a manifest that
// records row counts and a ledger fingerprint (income / expense / balance) you
// can diff before and after a deploy.
//
//   npx tsx scripts/backup-db.ts
//     → backs up whatever DATABASE_URL points at; with it unset, the local
//       PGlite dev database (./.pglite).
//
//   DATABASE_URL="postgresql://…neon.tech/…" npx tsx scripts/backup-db.ts
//     → backs up production. Take the connection string from the Vercel
//       project's environment variables; it is deliberately not stored here.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Physical table names, parents first — the order you'd restore them in.
const TABLES = [
  "users",
  "workspaces",
  "workspace_members",
  "app_settings",
  "accounts",
  "categories",
  "transactions",
  "transfers",
  "budgets",
  "recurring",
  "goals",
  "splits",
  "budget_alerts",
  "tags",
  "transaction_tags",
  "invitations",
  "sessions",
  "password_resets",
  "email_verifications",
  "rate_limits",
  "push_subscriptions",
];

type Row = Record<string, unknown>;
type Query = (text: string) => Promise<Row[]>;

/** Same selection rule as lib/db: a DATABASE_URL means Neon, otherwise the
 *  embedded PGlite dev database. */
async function connect(): Promise<{ query: Query; label: string; close: () => Promise<void> }> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    const host = (() => {
      try { return new URL(url).host; } catch { return "remote"; }
    })();
    // neon()'s default export is a tagged-template function; `.query()` is the
    // plain-string form these table dumps need.
    return {
      query: (t) => sql.query(t) as Promise<Row[]>,
      label: `Neon (${host})`,
      close: async () => {},
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const path = process.env.PGLITE_PATH ?? "./.pglite";
  const db = new PGlite(path);
  return {
    query: async (t) => (await db.query(t)).rows as Row[],
    label: `local PGlite (${path})`,
    close: () => db.close(),
  };
}

async function main() {
  const { query, label, close } = await connect();
  console.log(`source: ${label}\n`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join("backups", `backup-${stamp}`);
  mkdirSync(dir, { recursive: true });

  const counts: Record<string, number> = {};
  const captured: Record<string, Row[]> = {};
  for (const t of TABLES) {
    try {
      const rows = await query(`select * from ${t}`);
      writeFileSync(join(dir, `${t}.json`), JSON.stringify(rows, null, 2));
      captured[t] = rows;
      counts[t] = rows.length;
      console.log(`  ${t.padEnd(22)} ${rows.length}`);
    } catch (e) {
      counts[t] = -1;
      console.error(`  ${t.padEnd(22)} FAILED: ${(e as Error).message}`);
    }
  }

  // The figures that matter: recomputed from the dump, not read from the app.
  const tx = (captured.transactions ?? []) as { type: string; amount: string }[];
  const income = tx.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
  const expense = tx.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);
  const initial = ((captured.accounts ?? []) as { initial_balance: string }[])
    .reduce((s, a) => s + Number(a.initial_balance), 0);

  const totals = {
    transactions: tx.length,
    income: +income.toFixed(2),
    expense: +expense.toFixed(2),
    net: +(income - expense).toFixed(2),
    initialBalances: +initial.toFixed(2),
    totalBalance: +(initial + income - expense).toFixed(2),
  };

  writeFileSync(
    join(dir, "_manifest.json"),
    JSON.stringify({ at: new Date().toISOString(), source: label, counts, totals }, null, 2),
  );
  await close();

  console.log(`\nbackup written to ${dir}`);
  console.log("ledger fingerprint — compare this before and after any deploy:");
  console.log(JSON.stringify(totals, null, 2));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("BACKUP FAILED:", e);
    process.exit(1);
  },
);
