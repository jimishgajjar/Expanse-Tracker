import "dotenv/config";
import { getDb } from "../src/lib/db/index";
import { maybeSeed } from "../src/lib/db/seed";
import { users } from "../src/lib/db/schema";

// Seed a fresh (Neon) database with a demo user + personal workspace + sample
// data. Real users get their own workspace (with default categories) on signup.
// Demo login: demo@demo.com / password
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ Set DATABASE_URL (your Neon connection string) before seeding.");
    process.exit(1);
  }
  const db = await getDb();
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length) {
    console.log("• Database already has users — skipping seed.");
    return;
  }
  await maybeSeed(db);
  console.log("✓ Seeded demo@demo.com / password with a sample workspace.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
