"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { accounts, appSettings, categories, transactions } from "./db/schema";
import { findCurrencyByCode } from "./currencies";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

// ── accounts ─────────────────────────────────────────────
const accountSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  type: z.string().trim().min(1).default("bank"),
  icon: z.string().trim().min(1).default("wallet"),
  color: z.string().trim().min(1).default("#6366f1"),
  initialBalance: z.coerce.number().default(0),
});

export async function createAccount(input: unknown): Promise<Result> {
  try {
    const d = accountSchema.parse(input);
    const db = await getDb();
    await db.insert(accounts).values({ ...d, initialBalance: String(d.initialBalance) });
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function updateAccount(id: string, input: unknown): Promise<Result> {
  try {
    const d = accountSchema.partial().parse(input);
    const patch: Record<string, unknown> = { ...d };
    if (d.initialBalance !== undefined) patch.initialBalance = String(d.initialBalance);
    const db = await getDb();
    await db.update(accounts).set(patch).where(eq(accounts.id, id));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteAccount(id: string): Promise<Result> {
  try {
    const db = await getDb();
    await db.delete(accounts).where(eq(accounts.id, id)); // cascades to its transactions
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── categories ───────────────────────────────────────────
const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  kind: z.enum(["income", "expense"]),
  icon: z.string().trim().min(1).default("tag"),
  color: z.string().trim().min(1).default("#64748b"),
});

export async function createCategory(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const d = categorySchema.parse(input);
    const db = await getDb();
    const [row] = await db.insert(categories).values(d).returning({ id: categories.id });
    revalidatePath("/");
    return { ok: true, data: { id: row.id } };
  } catch (e) { return fail(e); }
}

export async function updateCategory(id: string, input: unknown): Promise<Result> {
  try {
    const d = categorySchema.partial().parse(input);
    const db = await getDb();
    await db.update(categories).set(d).where(eq(categories.id, id));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteCategory(id: string): Promise<Result> {
  try {
    const db = await getDb();
    await db.delete(categories).where(eq(categories.id, id)); // transactions keep, category → null
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── transactions ─────────────────────────────────────────
const txSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  note: z.string().trim().max(200).default(""),
  accountId: z.string().min(1, "Pick an account"),
  categoryId: z.string().min(1).nullable().optional(),
});

export async function createTransaction(input: unknown): Promise<Result> {
  try {
    const d = txSchema.parse(input);
    const db = await getDb();
    await db.insert(transactions).values({
      type: d.type, amount: String(d.amount), date: d.date,
      note: d.note ?? "", accountId: d.accountId, categoryId: d.categoryId ?? null,
    });
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function updateTransaction(id: string, input: unknown): Promise<Result> {
  try {
    const d = txSchema.partial().parse(input);
    const patch: Record<string, unknown> = { ...d };
    if (d.amount !== undefined) patch.amount = String(d.amount);
    const db = await getDb();
    await db.update(transactions).set(patch).where(eq(transactions.id, id));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteTransaction(id: string): Promise<Result> {
  try {
    const db = await getDb();
    await db.delete(transactions).where(eq(transactions.id, id));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── settings ─────────────────────────────────────────────
const settingsSchema = z.object({ currencyCode: z.string().min(1) });

export async function updateSettings(input: unknown): Promise<Result> {
  try {
    const d = settingsSchema.parse(input);
    if (!findCurrencyByCode(d.currencyCode)) throw new Error("Unknown currency");
    const db = await getDb();
    await db
      .insert(appSettings)
      .values({ id: "app", currencyCode: d.currencyCode })
      .onConflictDoUpdate({ target: appSettings.id, set: { currencyCode: d.currencyCode } });
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}
