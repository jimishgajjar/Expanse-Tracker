"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { accounts, appSettings, budgets, categories, recurring, transactions, transfers } from "./db/schema";
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

// ── budgets ──────────────────────────────────────────────
const budgetSchema = z.object({
  categoryId: z.string().min(1, "Pick a category"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});

export async function setBudget(input: unknown): Promise<Result> {
  try {
    const d = budgetSchema.parse(input);
    const db = await getDb();
    await db
      .insert(budgets)
      .values({ categoryId: d.categoryId, amount: String(d.amount) })
      .onConflictDoUpdate({ target: budgets.categoryId, set: { amount: String(d.amount) } });
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteBudget(categoryId: string): Promise<Result> {
  try {
    const db = await getDb();
    await db.delete(budgets).where(eq(budgets.categoryId, categoryId));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── transfers ────────────────────────────────────────────
const transferSchema = z
  .object({
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
    note: z.string().trim().max(200).default(""),
    fromAccountId: z.string().min(1, "Pick a source account"),
    toAccountId: z.string().min(1, "Pick a destination account"),
  })
  .refine((d) => d.fromAccountId !== d.toAccountId, { message: "Choose two different accounts", path: ["toAccountId"] });

export async function createTransfer(input: unknown): Promise<Result> {
  try {
    const d = transferSchema.parse(input);
    const db = await getDb();
    await db.insert(transfers).values({
      amount: String(d.amount), date: d.date, note: d.note ?? "",
      fromAccountId: d.fromAccountId, toAccountId: d.toAccountId,
    });
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteTransfer(id: string): Promise<Result> {
  try {
    const db = await getDb();
    await db.delete(transfers).where(eq(transfers.id, id));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── recurring ────────────────────────────────────────────
const recurringSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  note: z.string().trim().max(200).default(""),
  accountId: z.string().min(1, "Pick an account"),
  categoryId: z.string().min(1).nullable().optional(),
  frequency: z.enum(["weekly", "monthly", "yearly"]),
  nextDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
});

export async function createRecurring(input: unknown): Promise<Result> {
  try {
    const d = recurringSchema.parse(input);
    const db = await getDb();
    await db.insert(recurring).values({
      type: d.type, amount: String(d.amount), note: d.note ?? "",
      accountId: d.accountId, categoryId: d.categoryId ?? null,
      frequency: d.frequency, nextDate: d.nextDate,
    });
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteRecurring(id: string): Promise<Result> {
  try {
    const db = await getDb();
    await db.delete(recurring).where(eq(recurring.id, id));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}
