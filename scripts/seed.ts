import { resolve } from "node:path";
import { getDb } from "../src/lib/db/index";

// Seed a dedicated embedded preview with a demo user + personal workspace + sample
// data. Real users get their own workspace (with default categories) on signup.
// Demo login: demo@demo.com / password
async function main() {
  if (process.env.DATABASE_URL || process.env.VERCEL || process.env.NODE_ENV==="production") {
    console.error("✗ Demo seeding requires a local environment without a hosted database.");
    process.exit(1);
  }
  process.env.PGLITE_PATH=resolve(".pglite-preview");
  await getDb();
  console.log("✓ Local sample workspace is ready.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
