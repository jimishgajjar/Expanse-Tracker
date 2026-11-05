import { getDb } from "./db";
import { personalPreviewEnabled } from "./personal-preview";
import type { PGlite } from "@electric-sql/pglite";

// Next keeps the embedded connection through hot reloads. A preview already
// running when a new household migration is added must use that same connection to migrate.
const local = globalThis as typeof globalThis & { householdSchema33?: WeakMap<PGlite, Promise<void>> };
async function prepareLocalSchema(client: PGlite) {
  const { rows: [row] } = await client.query<{ present:boolean }>("SELECT to_regclass('public.forecast_baselines') IS NOT NULL AS present");
  if (row.present) return;
  const [{ drizzle }, { migrate }] = await Promise.all([
    import("drizzle-orm/pglite"), import("drizzle-orm/pglite/migrator"),
  ]);
  await migrate(drizzle(client), {migrationsFolder:"./drizzle"});
}

export async function localPersonalDb() {
  if (!personalPreviewEnabled()) return null;
  const [db, { PGlite }] = await Promise.all([getDb(), import("@electric-sql/pglite")]);
  if (!("$client" in db) || !(db.$client instanceof PGlite)) return null;
  const client = db.$client;
  const known = local.householdSchema33 ??= new WeakMap();
  let ready = known.get(client);
  if (!ready) {
    ready = prepareLocalSchema(client).catch(error => { known.delete(client); throw error; });
    known.set(client,ready);
  }
  await ready;
  return client;
}
