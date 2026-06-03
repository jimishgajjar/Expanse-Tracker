import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Used by `drizzle-kit generate` (reads the schema; no DB needed) and
// `drizzle-kit migrate`/`studio` (needs DATABASE_URL → your Neon database).
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder",
  },
  strict: true,
  verbose: true,
});
