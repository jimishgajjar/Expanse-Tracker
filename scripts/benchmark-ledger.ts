/** Synthetic, in-memory baseline. Never loads .env, getDb, or production data. */
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { AppDb } from "../src/lib/db";
import { activityFilterSchema, queryActivity } from "../src/lib/activity-query";

async function main() {
  const client = new PGlite();
  const db = drizzle(client);
  const measurements = [];
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await client.exec("INSERT INTO users(id,email,password_hash) VALUES ('fixture','fixture@example.test','unused')");
    for (const size of [1000, 10000, 100000]) {
      const workspace = `fixture-${size}`;
      await client.query("INSERT INTO workspaces(id,name,owner_id) VALUES ($1,'Synthetic benchmark','fixture')", [workspace]);
      await client.query("INSERT INTO accounts(id,workspace_id,name) VALUES ($1,$1,'Sample account')", [workspace]);
      await client.query(`INSERT INTO transactions(id,workspace_id,account_id,type,amount,date,note)
        SELECT $1||'-'||n,$1,$1,CASE WHEN n%10=0 THEN 'income'::tx_kind ELSE 'expense'::tx_kind END,
          CASE WHEN n%10=0 THEN 100 ELSE 12.34 END,'2026-01-01'::date+(n%365),
          CASE WHEN n%10=0 THEN 'Synthetic salary' ELSE 'Synthetic groceries' END
        FROM generate_series(1,$2::int) n`, [workspace, size]);
      await client.exec("ANALYZE transactions");
      for (const scenario of ["all", "expense-search", "last-page"] as const) {
        const filter = activityFilterSchema.parse({ start: "2026-01-01", end: "2027-01-01",
          ...(scenario === "expense-search" ? { type: "expense", search: "groceries", account: workspace } : {}),
          ...(scenario === "last-page" ? { page: Math.ceil(size / 25) } : {}),
        });
        const samples = [];
        let bytes = 0;
        for (let run = 0; run < 8; run++) {
          const start = performance.now();
          const result = await queryActivity(db as unknown as AppDb, workspace, filter);
          samples.push(Math.round((performance.now() - start) * 100) / 100);
          const expectedRows = scenario === "expense-search" ? size * 0.9 : size;
          if (result.total !== expectedRows || result.transactions.length !== 25 || result.transfers.length !== 0
            || Math.round(result.expense * 100) !== size * 0.9 * 1234
            || result.income !== (scenario === "expense-search" ? 0 : size / 10 * 100)
            || result.transactions.some(row => row.accountId !== workspace)) {
            throw new Error("Synthetic baseline failed correctness or workspace isolation checks.");
          }
          bytes = Buffer.byteLength(JSON.stringify(result));
        }
        const warm = samples.slice(1).sort((a, b) => a - b);
        const entry = { size, scenario, firstQueryMs: samples[0], warmMedianMs: warm[3],
          warmP95Ms: warm[Math.ceil(warm.length * 0.95) - 1], responseBytes: bytes, samplesMs: samples };
        measurements.push(entry);
        console.log(JSON.stringify(entry));
      }
    }
  } finally {
    await client.close();
  }
  if (process.argv.includes("--stdout")) return;
  const directory = join(process.cwd(), ".codex", "benchmarks");
  mkdirSync(directory, { recursive: true });
  const file = join(directory, `ledger-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), environment: "Synthetic in-memory PGlite; no network or browser latency",
    node: process.version, platform: platform(), cpu: cpus()[0]?.model,
    limitations: "Seven warm samples per case are diagnostic only, not a production SLO or a statistically robust tail estimate.", measurements }, null, 2));
  console.log(`Baseline saved: ${file}`);
}
main().catch(() => { console.error("Synthetic ledger benchmark failed; no production connection was used."); process.exitCode = 1; });
