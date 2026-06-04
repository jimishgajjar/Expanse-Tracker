import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { accounts, categories, transactions, users, workspaceMembers, workspaces } from "./schema";
import { hashPassword } from "../password";

type DB = NeonHttpDatabase<typeof schema>;

const ACCOUNTS = [
  { name: "Cash", type: "cash", icon: "banknote", color: "#f59e0b" },
  { name: "Bank", type: "bank", icon: "landmark", color: "#6366f1" },
  { name: "Card", type: "card", icon: "credit-card", color: "#f43f5e" },
];

const EXPENSE_CATS = [
  { name: "Food & Drink", icon: "utensils", color: "#f97316" },
  { name: "Groceries", icon: "shopping-basket", color: "#84cc16" },
  { name: "Transport", icon: "car", color: "#06b6d4" },
  { name: "Rent", icon: "house", color: "#8b5cf6" },
  { name: "Bills", icon: "receipt", color: "#eab308" },
  { name: "Shopping", icon: "shopping-bag", color: "#ec4899" },
  { name: "Health", icon: "heart-pulse", color: "#ef4444" },
  { name: "Entertainment", icon: "clapperboard", color: "#a855f7" },
];

const INCOME_CATS = [
  { name: "Salary", icon: "briefcase", color: "#10b981" },
  { name: "Freelance", icon: "laptop", color: "#14b8a6" },
  { name: "Investments", icon: "trending-up", color: "#22c55e" },
  { name: "Gifts", icon: "gift", color: "#f472b6" },
];

/** Seed a workspace with default accounts + categories, and optional sample transactions. */
export async function seed(db: DB, workspaceId: string, opts: { samples?: boolean } = {}) {
  const accs = await db.insert(accounts).values(ACCOUNTS.map((a) => ({ ...a, workspaceId }))).returning();
  const cats = await db
    .insert(categories)
    .values([
      ...EXPENSE_CATS.map((c) => ({ ...c, kind: "expense" as const, workspaceId })),
      ...INCOME_CATS.map((c) => ({ ...c, kind: "income" as const, workspaceId })),
    ])
    .returning();

  if (!opts.samples) return { accounts: accs, categories: cats };

  const acc = (name: string) => accs.find((a) => a.name === name)!.id;
  const cat = (name: string) => cats.find((c) => c.name === name)!.id;
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const rows = [
    { workspaceId, type: "income" as const,  amount: "85000", date: day(-20), note: "Monthly salary",  accountId: acc("Bank"), categoryId: cat("Salary") },
    { workspaceId, type: "income" as const,  amount: "18000", date: day(-9),  note: "Website project",  accountId: acc("Bank"), categoryId: cat("Freelance") },
    { workspaceId, type: "income" as const,  amount: "5000",  date: day(-2),  note: "Dividend payout",  accountId: acc("Bank"), categoryId: cat("Investments") },
    { workspaceId, type: "expense" as const, amount: "22000", date: day(-19), note: "Flat rent",        accountId: acc("Bank"), categoryId: cat("Rent") },
    { workspaceId, type: "expense" as const, amount: "3200",  date: day(-7),  note: "Big grocery run",  accountId: acc("Card"), categoryId: cat("Groceries") },
    { workspaceId, type: "expense" as const, amount: "640",   date: day(-6),  note: "Dinner out",       accountId: acc("Card"), categoryId: cat("Food & Drink") },
    { workspaceId, type: "expense" as const, amount: "300",   date: day(-5),  note: "Cab ride",         accountId: acc("Cash"), categoryId: cat("Transport") },
    { workspaceId, type: "expense" as const, amount: "1499",  date: day(-4),  note: "New headphones",   accountId: acc("Card"), categoryId: cat("Shopping") },
    { workspaceId, type: "expense" as const, amount: "899",   date: day(-3),  note: "Electricity bill", accountId: acc("Bank"), categoryId: cat("Bills") },
    { workspaceId, type: "expense" as const, amount: "250",   date: day(-1),  note: "Coffee",           accountId: acc("Cash"), categoryId: cat("Food & Drink") },
    { workspaceId, type: "income" as const,  amount: "85000", date: day(-50), note: "Salary",           accountId: acc("Bank"), categoryId: cat("Salary") },
    { workspaceId, type: "expense" as const, amount: "1200",  date: day(-40), note: "Dinner",           accountId: acc("Card"), categoryId: cat("Food & Drink") },
  ];
  await db.insert(transactions).values(rows);
  return { accounts: accs, categories: cats };
}

/** On a fresh local DB: create a demo user + their personal workspace + sample data. */
export async function maybeSeed(db: DB) {
  const hasUser = await db.select({ id: users.id }).from(users).limit(1);
  if (hasUser.length) return;

  // Local demo login: demo@demo.com / password
  const [u] = await db.insert(users).values({ email: "demo@demo.com", name: "Demo", passwordHash: hashPassword("password"), emailVerifiedAt: new Date() }).returning();
  const [w] = await db.insert(workspaces).values({ name: "Demo's tracker", ownerId: u.id }).returning();
  await db.insert(workspaceMembers).values({ workspaceId: w.id, userId: u.id, role: "owner" });
  await seed(db, w.id, { samples: true });
}
