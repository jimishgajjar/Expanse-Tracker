/** Verified application backup. Never runs migrations or writes on the source.
 * Production: tsx scripts/backup-db.ts --production --env=.vercel/.env.production.local
 * Local:      tsx scripts/backup-db.ts --local-path=.pglite-preview
 * Comparison: append --compare=backups/backup-... (existing financial rows must match).
 * Every backup is restored into a NEW in-memory Postgres and checked before success.
 */
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { neon } from "@neondatabase/serverless";

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
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
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
      Object.entries(row).filter(
        ([key]) =>
          !["next_date", "occurrence_count", "last_reminded_for"].includes(key),
      ),
    ),
  );
}
const tableHash = (rows: Row[]) => hash(rows.map(canonical).sort().join("\n"));
const tableSQL = (t: string) =>
  `SELECT to_jsonb(t) AS row FROM public."${t}" t`;
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

async function verifyRestore(snapshot: Snapshot) {
  // Deliberately no path or DATABASE_URL: every write is confined to memory.
  const isolated = new PGlite();
  try {
    await migrate(drizzle(isolated), { migrationsFolder: "./drizzle" });
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
    for (const table of TABLES) {
      const rows = (
        await isolated.query<{ row: Row }>(tableSQL(table))
      ).rows.map((r) => r.row);
      if (tableHash(rows) !== tableHash(snapshot.tables[table]))
        throw new Error(`Restore content mismatch: ${table}`);
    }
  } finally {
    await isolated.close();
  }
}

async function main() {
  const { snapshot, source } = await capture();
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
  cpSync("drizzle", join(directory, "drizzle"), { recursive: true });
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
