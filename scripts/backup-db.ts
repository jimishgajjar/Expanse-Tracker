/** Verified application backup. Never migrates or alters financial records on the source. Optional reporting writes backup-status metadata.
 * Production: tsx scripts/backup-db.ts --production --env=.vercel/.env.production.local
 * Local:      tsx scripts/backup-db.ts --local-path=.pglite-preview
 * Comparison: append --compare=backups/backup-... (existing financial rows must match).
 * Every backup is restored into a NEW in-memory Postgres and checked before success.
 */
import { config } from "dotenv";
import { encryptBackup, decryptBackup } from "../src/lib/backup-envelope";
import { unwrapRecoveryKey } from "../src/lib/recovery-key";
import { recoverySecretInput } from "./recovery-secret-input";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, cpSync, existsSync, readdirSync, mkdtempSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { neon } from "@neondatabase/serverless";
import { backupMigrationsForTables } from "./backup-migrations";
import { debtTables, currencyTables } from "../src/lib/finance-tables";

const backupArgs = process.argv.slice(2);
let migrationsFolder = backupArgs.find(a => a.startsWith("--migrations="))?.slice(13) ?? "./drizzle";
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
  ...(existsSync(join(migrationsFolder,"0011_transaction_history.sql")) ? ["transaction_history", "backup_reports"] : []),
];
const FINANCIAL = [
  "users",
  "recurring",
  "invitations",
  "push_subscriptions",
  "workspaces",
  "workspace_members",
  "app_settings",
  "accounts",
  "categories",
  "transactions",
  "transfers",
  "budgets",
  "goals",
  "splits",
  "tags",
  "transaction_tags",
];
type Row = Record<string, unknown>;
type Snapshot = {
  tables: Record<string, Row[]>;
  columns: Row[];
  migrations: Row[];
  at: string;
};
const args = process.argv.slice(2);
const value = (name: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
// Before an additive deployment, use the previous release's migrations to
// rehearse its still-live schema. The exact migrations are saved in the backup.

const hash = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.entries(v)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
      .join(",")}}`;
  return JSON.stringify(v);
}
function comparisonRow(table: string, row: Row): string {
  if (table !== "recurring") return canonical(row);
  // Scheduled processing may advance these values; the rule itself must survive.
  return canonical(
    Object.fromEntries(
      Object.entries({ tag_ids: [], ...row }).filter(
        ([key]) =>
          !["next_date", "occurrence_count", "last_reminded_for"].includes(key),
      ),
    ),
  );
}
const tableHash = (rows: Row[]) => hash(rows.map(canonical).sort().join("\n"));
const financeTables=new Set<string>([...debtTables,...currencyTables,"opening_cutoffs"]);
const tableSQL = (t: string) => financeTables.has(t)
  ? `SELECT (SELECT jsonb_object_agg(key, CASE WHEN jsonb_typeof(value)='number' THEN to_jsonb(value::text) ELSE value END)
      FROM jsonb_each(to_jsonb(t))) AS row FROM public."${t}" t`
  : `SELECT to_jsonb(t) AS row FROM public."${t}" t`;
const columnsSQL = `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`;
const tablesSQL = `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`;

async function capture(): Promise<{ snapshot: Snapshot; source: string }> {
  const production = args.includes("--production");
  const localPath = value("local-path");
  if (production === !!localPath)
    throw new Error("Choose exactly one of --production or --local-path=...");
  const queries = [
    tablesSQL,
    columnsSQL,
    "SELECT * FROM drizzle.__drizzle_migrations ORDER BY id",
    ...TABLES.map(tableSQL),
  ];
  function selectSourceSchema(sourceTables: Row[]) {
    const names = sourceTables.map(row=>String(row.table_name));
    migrationsFolder = backupMigrationsForTables(migrationsFolder,names);
    if (names.includes("reconciliation_sessions") && existsSync(join(migrationsFolder,"0012_statement_reviews.sql"))) {
      TABLES.push("reconciliation_sessions"); FINANCIAL.push("reconciliation_sessions");
      queries.push(tableSQL("reconciliation_sessions"));
    }
    if (names.includes("file_imports") && existsSync(join(migrationsFolder,"0013_file_imports.sql"))) {
      TABLES.push("file_imports"); FINANCIAL.push("file_imports"); queries.push(tableSQL("file_imports"));
    }
    if (names.includes("merchant_rule_versions") && existsSync(join(migrationsFolder,"0014_merchant_rules.sql"))) {
      TABLES.push("merchant_rule_versions"); FINANCIAL.push("merchant_rule_versions"); queries.push(tableSQL("merchant_rule_versions"));
    }
    if(names.includes("purchase_allocations")){
      TABLES.push("purchase_allocations"); FINANCIAL.push("purchase_allocations"); queries.push(tableSQL("purchase_allocations"));
    }
    for(const table of ["receipt_images","capture_drafts","monthly_plans","goal_reservations","pay_period_plans","annual_goal_plans","refund_links","budget_moves","goal_opening_reviews","forecast_scenarios","personal_ledgers","account_shares","reimbursements","transaction_comments","notification_preferences","invitation_preferences","comment_mentions",...debtTables,...currencyTables,"household_setup","opening_cutoffs","pilot_feedback","weekly_review_progress","weekly_review_receipts","forecast_baselines"])if(names.includes(table)){
      TABLES.push(table); FINANCIAL.push(table); queries.push(tableSQL(table));
    }
  }
  let results: Row[][];
  let source: string;
  if (production) {
    const envFile = value("env");
    if (envFile)
      config({ path: resolve(envFile), override: true, quiet: true });
    const url = process.env.DATABASE_URL?.trim();
    if (!url)
      throw new Error(
        "Production DATABASE_URL is missing; refusing local fallback.",
      );
    source = new URL(url).hostname;
    const sql = neon(url);
    const [sourceTables] = await sql.transaction([sql.query(tablesSQL)],{readOnly:true});
    selectSourceSchema(sourceTables);
    const [migrationTable] = await sql.transaction(
      [
        sql.query(
          "SELECT to_regclass('drizzle.__drizzle_migrations') AS relation",
        ),
      ],
      { readOnly: true },
    );
    if (!migrationTable[0]?.relation) queries[2] = "SELECT NULL WHERE FALSE";
    results = (await sql.transaction(
      queries.map((q) => sql.query(q)),
      { isolationLevel: "RepeatableRead", readOnly: true },
    )) as Row[][];
  } else {
    source = `local:${resolve(localPath!)}`;
    const db = new PGlite(resolve(localPath!));
    try {
      selectSourceSchema((await db.query<Row>(tablesSQL)).rows);
      results = await db.transaction(async (tx) => {
        await tx.exec(
          "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
        );
        const migrationTable = await tx.query<{ relation: string | null }>(
          "SELECT to_regclass('drizzle.__drizzle_migrations') AS relation",
        );
        if (!migrationTable.rows[0]?.relation)
          queries[2] = "SELECT NULL WHERE FALSE";
        const rows: Row[][] = [];
        for (const q of queries) rows.push((await tx.query<Row>(q)).rows);
        return rows;
      });
    } finally {
      await db.close();
    }
  }
  const actual = results[0].map((r) => r.table_name).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...TABLES].sort()))
    throw new Error(
      "Unexpected source tables; stop and extend backup coverage before deploying.",
    );
  const tables = Object.fromEntries(
    TABLES.map((t, i) => [t, results[i + 3].map((r) => r.row as Row)]),
  );
  return {
    source,
    snapshot: {
      at: new Date().toISOString(),
      tables,
      columns: results[1],
      migrations: results[2],
    },
  };
}

const balancesSQL = `SELECT a.id, (a.initial_balance
  + COALESCE((SELECT sum(CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END) FROM transactions t WHERE t.account_id=a.id),0)
  + COALESCE((SELECT sum(t.amount) FROM transfers t WHERE t.to_account_id=a.id),0)
  - COALESCE((SELECT sum(t.amount) FROM transfers t WHERE t.from_account_id=a.id),0))::text AS balance
  FROM accounts a ORDER BY a.id`;

async function checkRestored(isolated: PGlite, snapshot: Snapshot) {
  const localColumns = (await isolated.query<Row>(columnsSQL)).rows;
  if (canonical(localColumns) !== canonical(snapshot.columns))
    throw new Error("Live schema differs from archived migrations; restore rehearsal stopped.");
  for (const table of TABLES) {
    if (!/^[a-z][a-z0-9_]*$/.test(table)) throw new Error("Invalid backup table name.");
    const rows = (await isolated.query<{ row: Row }>(tableSQL(table))).rows.map(r => r.row);
    if (tableHash(rows) !== tableHash(snapshot.tables[table]))
      throw new Error(`Restore content mismatch: ${table}`);
  }
  return tableHash((await isolated.query<Row>(balancesSQL)).rows);
}

async function verifyRestore(snapshot: Snapshot, directory?: string) {
  // Never accept a connection URL. The caller exclusively creates a fresh drill directory.
  const isolated = new PGlite(directory);
  let balancesHash: string;
  try {
    await migrate(drizzle(isolated), { migrationsFolder });
    const localColumns = (await isolated.query<Row>(columnsSQL)).rows;
    if (canonical(localColumns) !== canonical(snapshot.columns))
      throw new Error(
        "Live schema differs from repository migrations; restore rehearsal stopped.",
      );
    await isolated.transaction(async (tx) => {
      for (const table of TABLES) {
        await tx.query(
          `INSERT INTO public."${table}" SELECT * FROM jsonb_populate_recordset(NULL::public."${table}", $1::jsonb)`,
          [JSON.stringify(snapshot.tables[table])],
        );
      }
    });
    balancesHash = await checkRestored(isolated, snapshot);
  } finally {
    await isolated.close();
  }
  if (directory) {
    // A second database instance must read the persisted files, not the previous instance's RAM.
    const reopened = new PGlite(directory);
    try {
      if (await checkRestored(reopened, snapshot) !== balancesHash)
        throw new Error("Account balances changed after reopening the restored database.");
    } finally { await reopened.close(); }
  }
  return balancesHash;
}

async function main() {
  let backupKey=process.env.BACKUP_KEY??"";
  if(value("recovery-key")){
    if(!value("verify-encrypted"))throw Error("Portable recovery keys are only accepted for an isolated archive verification or recovery drill.");
    const input=await recoverySecretInput();
    backupKey=await unwrapRecoveryKey(readFileSync(resolve(value("recovery-key")!)),input.passphrase);
  }
  if (args.includes("--recovery-drill") && !value("verify-encrypted"))
    throw new Error("A recovery drill requires --verify-encrypted; it never connects to production.");
  if (value("verify-encrypted")) {
    const started = new Date();
    const startedClock = performance.now();
    const saved = decryptBackup(readFileSync(resolve(value("verify-encrypted")!)), backupKey) as {snapshot:Snapshot;migrations:Record<string,string>};
    migrationsFolder = mkdtempSync(join(tmpdir(),"expense-restore-"));
    for (const [name, contents] of Object.entries(saved.migrations)) {
      const path = resolve(migrationsFolder,name);
      if (!path.startsWith(resolve(migrationsFolder)+"/") && !path.startsWith(resolve(migrationsFolder)+"\\")) throw new Error("Invalid migration path in backup.");
      mkdirSync(dirname(path),{recursive:true}); writeFileSync(path,contents);
    }
    TABLES.splice(0,TABLES.length,...Object.keys(saved.snapshot.tables));
    if (TABLES.some(t => !/^[a-z][a-z0-9_]*$/.test(t))) throw new Error("Invalid backup table name.");
    if (args.includes("--recovery-drill")) {
      // No user-provided database path and no reuse of any existing destination.
      const root = resolve("backups/recovery-drills");
      mkdirSync(root, { recursive: true, mode: 0o700 });
      const drill = mkdtempSync(join(root, "restore-"));
      const database = join(drill, "database");
      const balancesHash = await verifyRestore(saved.snapshot, database);
      const snapshotAgeSeconds = (started.getTime() - Date.parse(saved.snapshot.at)) / 1000;
      if (!Number.isFinite(snapshotAgeSeconds) || snapshotAgeSeconds < 0) throw new Error("Invalid snapshot time.");
      const durationSeconds = (performance.now() - startedClock) / 1000;
      const receipt = {
        version: 1, startedAt: started.toISOString(), finishedAt: new Date().toISOString(),
        backupFile: resolve(value("verify-encrypted")!), backupSha256: hash(readFileSync(resolve(value("verify-encrypted")!))),
        snapshotAt: saved.snapshot.at, snapshotAgeSeconds, durationSeconds,
        tables: TABLES.length, rows: Object.values(saved.snapshot.tables).reduce((n, rows) => n + rows.length, 0),
        accounts: saved.snapshot.tables.accounts.length, transactions: saved.snapshot.tables.transactions.length,
        transfers: saved.snapshot.tables.transfers.length, balancesHash, database,
        exactRowsVerified: true, reopenedFromDisk: true,
        snapshotUnder24Hours: snapshotAgeSeconds < 86400, restoreUnder4Hours: durationSeconds < 14400,
        scope: "Isolated local database restore. Does not prove off-machine key recovery, application cutover, or reconciliation of writes after the snapshot.",
      };
      const receiptFile = join(drill, "receipt.json");
      writeFileSync(receiptFile, JSON.stringify(receipt, null, 2), { mode: 0o600, flag: "wx" });
      console.log(JSON.stringify({ receiptFile, ...receipt }));
      return;
    }
    await verifyRestore(saved.snapshot);
    console.log("Encrypted backup decrypted and restored successfully in isolated memory.");
    return;
  }
  const { snapshot, source } = await capture();
  if (args.includes("--encrypted")) {
    const root = resolve(value("output") ?? "backups/encrypted");
    mkdirSync(root,{recursive:true});
    const migrations:Record<string,string> = {};
    for (const entry of readdirSync(migrationsFolder,{recursive:true,withFileTypes:true})) if (entry.isFile()) {
      const path = join(entry.parentPath,entry.name);
      migrations[relative(migrationsFolder,path)] = readFileSync(path,"utf8");
    }
    const path = join(root,`backup-${snapshot.at.replace(/[:.]/g,"-")}.etb`);
    writeFileSync(path,encryptBackup({version:1,snapshot,source,migrations},process.env.BACKUP_KEY ?? ""),{mode:0o600,flag:"wx"});
    const stored = decryptBackup(readFileSync(path),process.env.BACKUP_KEY ?? "") as {snapshot:Snapshot};
    await verifyRestore(stored.snapshot);
    if (value("compare-encrypted")) {
      const baseline = decryptBackup(readFileSync(resolve(value("compare-encrypted")!)),process.env.BACKUP_KEY ?? "") as {snapshot:Snapshot;source:string};
      if (baseline.source !== source) throw new Error("Backup comparison source mismatch.");
      for (const table of FINANCIAL) {
        if (["reconciliation_sessions","file_imports","merchant_rule_versions","purchase_allocations","receipt_images","capture_drafts","monthly_plans","goal_reservations","pay_period_plans","annual_goal_plans","refund_links","budget_moves","goal_opening_reviews","forecast_scenarios","personal_ledgers","account_shares","reimbursements","transaction_comments","notification_preferences","invitation_preferences","comment_mentions",...debtTables,...currencyTables,"household_setup","opening_cutoffs","pilot_feedback","weekly_review_progress","weekly_review_receipts","forecast_baselines"].includes(table) && !baseline.snapshot.tables[table]) continue;
        const current = new Set(stored.snapshot.tables[table].map(row => comparisonRow(table,row)));
        if (baseline.snapshot.tables[table].some(row => !current.has(comparisonRow(table,row)))) throw new Error(`Existing records changed in ${table}. Investigate without restoring over newer data.`);
      }
    }
    if (value("compare-encrypted")) console.log("Existing financial rows verified unchanged in all compared tables.");
    const rows = Object.values(snapshot.tables).reduce((n,items) => n+items.length,0);
    writeFileSync(join(root,"status.json"),JSON.stringify({verifiedAt:snapshot.at,file:path,restoreVerified:true,rows},null,2));
    if (args.includes("--report-production")) {
      if (!args.includes("--production") || !snapshot.tables.backup_reports) throw new Error("Backup reporting requires the production backup-status schema.");
      const client = neon(process.env.DATABASE_URL!);
      for (const workspace of snapshot.tables.workspaces) await client`INSERT INTO backup_reports(workspace_id,verified_at,row_count) VALUES (${workspace.id},${snapshot.at}::timestamp,${rows}) ON CONFLICT(workspace_id) DO UPDATE SET verified_at=EXCLUDED.verified_at,row_count=EXCLUDED.row_count`;
    }
    console.log(JSON.stringify({file:path,rows,restoreVerified:true,encrypted:true}));
    return;
  }

  const directory = resolve(
    "backups",
    `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
  mkdirSync(directory, { recursive: true });
  const files: Record<string, { rows: number; sha256: string }> = {};
  for (const table of TABLES) {
    const contents = JSON.stringify(snapshot.tables[table], null, 2);
    writeFileSync(join(directory, `${table}.json`), contents, { mode: 0o600 });
    files[table] = {
      rows: snapshot.tables[table].length,
      sha256: hash(contents),
    };
  }
  writeFileSync(
    join(directory, "_schema.json"),
    JSON.stringify(
      { columns: snapshot.columns, migrations: snapshot.migrations },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  cpSync(migrationsFolder, join(directory, "drizzle"), { recursive: true });
  const manifest = {
    at: snapshot.at,
    source,
    consistency: "repeatable-read read-only",
    files,
    restoreVerified: false,
  };
  const manifestPath = join(directory, "_manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), {
    mode: 0o600,
  });
  // Read back from disk before rehearsal, so the saved files—not only RAM—are verified.
  for (const table of TABLES) {
    const contents = readFileSync(join(directory, `${table}.json`), "utf8");
    if (hash(contents) !== files[table].sha256)
      throw new Error(`Backup checksum mismatch: ${table}`);
    snapshot.tables[table] = JSON.parse(contents);
  }
  await verifyRestore(snapshot);
  manifest.restoreVerified = true;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), {
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      directory,
      source,
      tables: TABLES.length,
      rows: Object.values(files).reduce((n, t) => n + t.rows, 0),
      restoreVerified: true,
    }),
  );
  const previous = value("compare");
  if (previous) {
    const baseline = JSON.parse(
      readFileSync(join(resolve(previous), "_manifest.json"), "utf8"),
    );
    if (!baseline.restoreVerified || baseline.source !== source)
      throw new Error("Baseline must be verified and from the same source.");
    const report: Record<
      string,
      { before: number; after: number; missingOrChanged: number }
    > = {};
    for (const table of FINANCIAL) {
      if (["reconciliation_sessions","file_imports","merchant_rule_versions","purchase_allocations","receipt_images","capture_drafts","monthly_plans","goal_reservations","pay_period_plans","annual_goal_plans","refund_links","budget_moves","goal_opening_reviews","forecast_scenarios","personal_ledgers","account_shares","reimbursements","transaction_comments","notification_preferences","invitation_preferences","comment_mentions",...debtTables,...currencyTables,"household_setup","opening_cutoffs","pilot_feedback","weekly_review_progress","weekly_review_receipts","forecast_baselines"].includes(table) && !existsSync(join(resolve(previous),`${table}.json`))) continue;
      const old: Row[] = JSON.parse(
        readFileSync(join(resolve(previous), `${table}.json`), "utf8"),
      );
      const available = new Map<string, number>();
      for (const row of snapshot.tables[table]) {
        const key = comparisonRow(table, row);
        available.set(key, (available.get(key) ?? 0) + 1);
      }
      let missingOrChanged = 0;
      for (const row of old) {
        const key = comparisonRow(table, row),
          n = available.get(key) ?? 0;
        if (n) available.set(key, n - 1);
        else missingOrChanged++;
      }
      report[table] = {
        before: old.length,
        after: snapshot.tables[table].length,
        missingOrChanged,
      };
    }
    writeFileSync(
      join(directory, "_comparison.json"),
      JSON.stringify(report, null, 2),
      { mode: 0o600 },
    );
    const altered = Object.entries(report)
      .filter(([, r]) => r.missingOrChanged > 0)
      .map(([t]) => t);
    if (altered.length)
      throw new Error(
        `Existing financial rows changed in: ${altered.join(", ")}. Investigate; do not overwrite newer live data.`,
      );
    console.log(
      "Existing financial rows verified unchanged in all compared tables.",
    );
  }
}
main().catch((error) => {
  console.error(
    "BACKUP/VERIFICATION FAILED:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
});
