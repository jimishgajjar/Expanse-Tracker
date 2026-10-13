/** This release only. Requires a fresh, encrypted, restore-verified backup. */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { decryptBackup } from "../src/lib/backup-envelope";

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Pass the fresh encrypted baseline backup path.");
  config({path: ".env.production.backup.local",override:true,quiet:true});
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Production connection is missing; no fallback allowed.");
  const baseline = decryptBackup(readFileSync(path),process.env.BACKUP_KEY ?? "") as {source:string;snapshot:{at:string}};
  const status = JSON.parse(readFileSync("backups/encrypted/status.json","utf8"));
  if (!status.restoreVerified || status.verifiedAt !== baseline.snapshot.at || baseline.source !== new URL(url).hostname || Date.now()-Date.parse(baseline.snapshot.at)>60*60*1000) throw new Error("A verified backup from this database, less than one hour old, is required.");
  const source = readFileSync("drizzle/0011_transaction_history.sql","utf8");
  const statements = source.split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean);
  if (!statements.every(s => /^(CREATE TABLE "(backup_reports|transaction_history)"|ALTER TABLE "(backup_reports|transaction_history)" ADD CONSTRAINT|CREATE INDEX "history_ws_tx_idx")/.test(s))) throw new Error("Migration contains an unexpected operation.");
  const db = neon(url);
  const [state] = await db`SELECT to_regclass('public.transaction_history') AS history,to_regclass('public.backup_reports') AS reports,to_regclass('drizzle.__drizzle_migrations') AS journal`;
  if (state.history && state.reports) { console.log("Additive tables already exist; no changes applied. Verify their schema with the backup rehearsal."); return; }
  if (state.history || state.reports) throw new Error("Partial schema detected; refusing to continue.");
  const queries = [db.query("SET LOCAL lock_timeout = '5s'"), db.query("SET LOCAL statement_timeout = '30s'"),db.query("SELECT pg_advisory_xact_lock(178056,11)"),...statements.map(statement=>db.query(statement))];
  if (state.journal) {
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json","utf8"));
    const entry = journal.entries.find((e:{tag:string})=>e.tag === "0011_transaction_history");
    queries.push(db.query('INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ($1,$2)',[createHash("sha256").update(source).digest("hex"),entry.when]));
  }
  await db.transaction(queries);
  console.log("Created edit-history and backup-status tables atomically. No existing financial tables modified.");
}
main().catch(() => { console.error("Guarded migration failed; production release must stop. Inspect the preconditions and schema without overwriting data."); process.exitCode=1; });
