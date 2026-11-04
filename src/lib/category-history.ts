import { and, desc, eq, sql } from "drizzle-orm";
import type { AppDb } from "./db";
import { categories, transactions } from "./db/schema";

export async function categoriesForNote(
  db: AppDb, workspaceId: string, accountId: string, type: "income" | "expense", note: string,
) {
  const usage = sql<number>`count(*)::int`;
  return db.select({ categoryId: categories.id, count: usage })
    .from(transactions)
    .innerJoin(categories, and(eq(categories.id, transactions.categoryId),
      eq(categories.workspaceId, workspaceId), eq(categories.kind, type)))
    .where(and(eq(transactions.workspaceId, workspaceId), eq(transactions.accountId, accountId),
      eq(transactions.type, type), sql`lower(trim(${transactions.note})) = lower(trim(${note}))`))
    .groupBy(categories.id)
    .orderBy(desc(usage), categories.id);
}
