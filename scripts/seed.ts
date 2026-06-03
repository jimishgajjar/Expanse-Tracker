import "dotenv/config";
import { getDb } from "../src/lib/db/index";
import { seed } from "../src/lib/db/seed";
import { accounts } from "../src/lib/db/schema";

// Seed a real (Neon) database with default accounts + categories.
// Usage: npm run db:seed            (defaults only)
//        npm run db:seed -- --samples  (also add example transactions)
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ Set DATABASE_URL (your Neon connection string) before seeding.");
    process.exit(1);
  }
  const db = await getDb();
  const existing = await db.select({ id: accounts.id }).from(accounts).limit(1);
  if (existing.length) {
    console.log("• Database already has data — skipping seed.");
    return;
  }
  const samples = process.argv.includes("--samples");
  await seed(db, { samples });
  console.log(`✓ Seeded default accounts + categories${samples ? " + sample transactions" : ""}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
