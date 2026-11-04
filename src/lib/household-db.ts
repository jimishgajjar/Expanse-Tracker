import { Client } from "@neondatabase/serverless";
import { hostedHouseholdEnabled } from "./household-features";
import { localPersonalDb } from "./local-personal-db";

export interface HouseholdReader {
  query<T extends Record<string,unknown> = Record<string,unknown>>(sql:string, params?:unknown[]): Promise<{rows:T[]}>;
}
export interface HouseholdTransaction extends HouseholdReader {
  exec(sql:string): Promise<unknown>;
}
export interface HouseholdDb extends HouseholdReader {
  transaction<T>(work:(tx:HouseholdTransaction)=>Promise<T>): Promise<T>;
}

// Household operations lock and inspect rows between statements. They need one PostgreSQL
// session per operation. The HTTP driver remains appropriate for independent queries.
export function hostedHouseholdDb(connectionString:string):HouseholdDb {
  async function withSession<T>(work:(client:Client)=>Promise<T>) {
    const client = new Client({connectionString, connectionTimeoutMillis:10000});
    await client.connect();
    try { return await work(client); } finally { await client.end(); }
  }
  return {
    query: (sql,params) => withSession(client=>client.query(sql,params)),
    transaction: work => withSession(async client => {
      await client.query("BEGIN");
      try {
        const result = await work({query:(sql,params)=>client.query(sql,params),exec:sql=>client.query(sql)});
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }),
  };
}

export async function getHouseholdDb():Promise<HouseholdDb|null> {
  if (hostedHouseholdEnabled()) return hostedHouseholdDb(process.env.DATABASE_URL!);
  return localPersonalDb();
}

// Planning also supports a custom embedded database directory during development.
export async function getPlanningDb():Promise<HouseholdDb|null> {
  const household = await getHouseholdDb();
  if (household || process.env.NODE_ENV !== "development" || process.env.DATABASE_URL ||
      process.env.VERCEL || !process.env.PGLITE_PATH) return household;
  const [{getDb}, {PGlite}] = await Promise.all([import("./db"), import("@electric-sql/pglite")]);
  const db = await getDb();
  return "$client" in db && db.$client instanceof PGlite ? db.$client : null;
}
