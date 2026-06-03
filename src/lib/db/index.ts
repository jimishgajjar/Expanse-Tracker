import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { maybeSeed } from "./seed";

// We type the whole app against the Neon driver's database type. The local
// PGlite driver is API-compatible for everything we use, so we cast it to the
// same type — keeping query code identical in dev and production.
export type AppDb = NeonHttpDatabase<typeof schema>;

async function create(): Promise<AppDb> {
  const url = process.env.DATABASE_URL;

  if (url) {
    // Production / Neon: pure-JS HTTP driver, ideal for serverless (Vercel).
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(neon(url), { schema });
  }

  // Local dev with zero setup: an embedded Postgres (PGlite) persisted to
  // ./.pglite, auto-migrated and seeded on first use.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(process.env.PGLITE_PATH ?? "./.pglite");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await maybeSeed(db as unknown as AppDb);
  return db as unknown as AppDb;
}

// Cache the connection across HMR reloads so dev doesn't open many PGlite
// handles on the same directory.
const g = globalThis as unknown as { __dbPromise?: Promise<AppDb> };

export function getDb(): Promise<AppDb> {
  if (!g.__dbPromise) g.__dbPromise = create();
  return g.__dbPromise;
}
