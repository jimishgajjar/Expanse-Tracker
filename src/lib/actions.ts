"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import { accounts, appSettings, budgets, categories, goals, recurring, splits, tags, transactionTags, transactions, transfers, workspaceMembers } from "./db/schema";
import { findCurrencyByCode } from "./currencies";
import { getActiveRole, getActiveWorkspaceId, getUserWorkspaces } from "./workspace";
import { getCurrentUser, setActiveWorkspace } from "./session";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

/** Active workspace id, or throw (→ {ok:false}). Every mutation is scoped to it,
 *  and view-only members are blocked from writing. */
async function wid(): Promise<string> {
  const id = await getActiveWorkspaceId();
  if (!id) throw new Error("You're not signed in.");
  if ((await getActiveRole()) === "viewer") throw new Error("You have view-only access to this tracker.");
  return id;
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
    const w = await wid();
    const db = await getDb();
    await db.insert(accounts).values({ ...d, workspaceId: w, initialBalance: String(d.initialBalance) });
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function updateAccount(id: string, input: unknown): Promise<Result> {
  try {
    const d = accountSchema.partial().parse(input);
    const patch: Record<string, unknown> = { ...d };
    if (d.initialBalance !== undefined) patch.initialBalance = String(d.initialBalance);
    const w = await wid();
    const db = await getDb();
    await db.update(accounts).set(patch).where(and(eq(accounts.id, id), eq(accounts.workspaceId, w)));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteAccount(id: string): Promise<Result> {
  try {
    const w = await wid();
    const db = await getDb();
    await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.workspaceId, w)));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// Hide an account from the active dashboard without deleting anything — reversible.
export async function setAccountArchived(id: string, archived: boolean): Promise<Result> {
  try {
    const w = await wid();
    const db = await getDb();
    await db.update(accounts).set({ archived }).where(and(eq(accounts.id, id), eq(accounts.workspaceId, w)));
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
    const w = await wid();
    const db = await getDb();
    const [row] = await db.insert(categories).values({ ...d, workspaceId: w }).returning({ id: categories.id });
    revalidatePath("/");
    return { ok: true, data: { id: row.id } };
  } catch (e) { return fail(e); }
}

export async function updateCategory(id: string, input: unknown): Promise<Result> {
  try {
    const d = categorySchema.partial().parse(input);
    const w = await wid();
    const db = await getDb();
    await db.update(categories).set(d).where(and(eq(categories.id, id), eq(categories.workspaceId, w)));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteCategory(id: string): Promise<Result> {
  try {
    const w = await wid();
    const db = await getDb();
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.workspaceId, w)));
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
  tagIds: z.array(z.string()).optional(),
});

export async function createTransaction(input: unknown): Promise<Result> {
  try {
    const d = txSchema.parse(input);
    const w = await wid();
    const me = await getCurrentUser();
    const db = await getDb();
    const [row] = await db.insert(transactions).values({
      workspaceId: w, type: d.type, amount: String(d.amount), date: d.date,
      note: d.note ?? "", accountId: d.accountId, categoryId: d.categoryId ?? null,
      createdBy: me?.id ?? null,
    }).returning({ id: transactions.id });
    if (d.tagIds?.length) await db.insert(transactionTags).values(d.tagIds.map((tagId) => ({ transactionId: row.id, tagId })));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function updateTransaction(id: string, input: unknown): Promise<Result> {
  try {
    const d = txSchema.partial().parse(input);
    const { tagIds, ...rest } = d;
    const patch: Record<string, unknown> = { ...rest };
    if (d.amount !== undefined) patch.amount = String(d.amount);
    const w = await wid();
    const db = await getDb();
    const [owned] = await db.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.id, id), eq(transactions.workspaceId, w))).limit(1);
    if (!owned) return { ok: false, error: "Transaction not found." };
    if (Object.keys(patch).length) await db.update(transactions).set(patch).where(and(eq(transactions.id, id), eq(transactions.workspaceId, w)));
    if (tagIds !== undefined) {
      await db.delete(transactionTags).where(eq(transactionTags.transactionId, id));
      if (tagIds.length) await db.insert(transactionTags).values(tagIds.map((tagId) => ({ transactionId: id, tagId })));
    }
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteTransaction(id: string): Promise<Result> {
  try {
    const w = await wid();
    const db = await getDb();
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.workspaceId, w)));
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
    const w = await wid();
    const db = await getDb();
    await db
      .insert(appSettings)
      .values({ workspaceId: w, currencyCode: d.currencyCode })
      .onConflictDoUpdate({ target: appSettings.workspaceId, set: { currencyCode: d.currencyCode } });
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
    const w = await wid();
    const db = await getDb();
    await db
      .insert(budgets)
      .values({ workspaceId: w, categoryId: d.categoryId, amount: String(d.amount) })
      .onConflictDoUpdate({ target: budgets.categoryId, set: { amount: String(d.amount) } });
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteBudget(categoryId: string): Promise<Result> {
  try {
    const w = await wid();
    const db = await getDb();
    await db.delete(budgets).where(and(eq(budgets.categoryId, categoryId), eq(budgets.workspaceId, w)));
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
    const w = await wid();
    const db = await getDb();
    await db.insert(transfers).values({
      workspaceId: w, amount: String(d.amount), date: d.date, note: d.note ?? "",
      fromAccountId: d.fromAccountId, toAccountId: d.toAccountId,
    });
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteTransfer(id: string): Promise<Result> {
  try {
    const w = await wid();
    const db = await getDb();
    await db.delete(transfers).where(and(eq(transfers.id, id), eq(transfers.workspaceId, w)));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── recurring ────────────────────────────────────────────
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");
const recurringSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  note: z.string().trim().max(200).default(""),
  accountId: z.string().min(1, "Pick an account"),
  categoryId: z.string().min(1).nullable().optional(),
  frequency: z.enum(["weekly", "monthly", "yearly"]),
  nextDate: dateStr,
  endDate: dateStr.nullable().optional(),
  maxOccurrences: z.coerce.number().int().positive().nullable().optional(),
  alertsEnabled: z.coerce.boolean().optional(),
  remindDaysBefore: z.coerce.number().int().min(0).max(30).optional(),
  commitmentType: z.enum(["subscription", "bill", "emi", "other"]).optional(),
  autoPost: z.coerce.boolean().optional(),
  totalAmount: z.coerce.number().positive().nullable().optional(),
}).refine((d) => !d.endDate || d.endDate >= d.nextDate, { message: "End date must be after the start date", path: ["endDate"] });

export async function createRecurring(input: unknown): Promise<Result> {
  try {
    const d = recurringSchema.parse(input);
    const w = await wid();
    const db = await getDb();
    await db.insert(recurring).values({
      workspaceId: w, type: d.type, amount: String(d.amount), note: d.note ?? "",
      accountId: d.accountId, categoryId: d.categoryId ?? null,
      frequency: d.frequency, nextDate: d.nextDate,
      endDate: d.endDate ?? null, maxOccurrences: d.maxOccurrences ?? null,
      alertsEnabled: d.alertsEnabled ?? false, remindDaysBefore: d.remindDaysBefore ?? 1,
      commitmentType: d.commitmentType ?? "other", autoPost: d.autoPost ?? true,
      totalAmount: d.totalAmount != null ? String(d.totalAmount) : null,
    });
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteRecurring(id: string): Promise<Result> {
  try {
    const w = await wid();
    const db = await getDb();
    await db.delete(recurring).where(and(eq(recurring.id, id), eq(recurring.workspaceId, w)));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── workspace switching ──────────────────────────────────
export async function switchWorkspace(workspaceId: string): Promise<Result> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };
    const memberships = await getUserWorkspaces();
    if (!memberships.some((m) => m.id === workspaceId)) return { ok: false, error: "No access to that account." };
    await setActiveWorkspace(workspaceId);
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── savings goals ──────────────────────────────────
const goalSchema = z.object({
  name: z.string().trim().min(1, "Name your goal").max(80),
  targetAmount: z.coerce.number().positive("Target must be greater than 0"),
  savedAmount: z.coerce.number().min(0).optional(),
  deadline: dateStr.nullable().optional(),
  color: z.string().optional(),
});

export async function createGoal(input: unknown): Promise<Result> {
  try {
    const d = goalSchema.parse(input);
    const w = await wid();
    const db = await getDb();
    await db.insert(goals).values({
      workspaceId: w, name: d.name, targetAmount: String(d.targetAmount),
      savedAmount: String(d.savedAmount ?? 0), deadline: d.deadline ?? null, color: d.color || "#047857",
    });
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function contributeGoal(id: string, amount: number): Promise<Result> {
  try {
    if (!Number.isFinite(amount) || amount === 0) return { ok: false, error: "Enter an amount." };
    const w = await wid();
    const db = await getDb();
    await db.update(goals).set({ savedAmount: sql`greatest(0, ${goals.savedAmount} + ${amount})` })
      .where(and(eq(goals.id, id), eq(goals.workspaceId, w)));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteGoal(id: string): Promise<Result> {
  try {
    const w = await wid();
    const db = await getDb();
    await db.delete(goals).where(and(eq(goals.id, id), eq(goals.workspaceId, w)));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── shared expenses (splits / IOUs) ──────────────────────────
const splitSchema = z.object({
  note: z.string().trim().max(200).default(""),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  creditorId: z.string().min(1),
  debtorId: z.string().min(1),
});

export async function createSplit(input: unknown): Promise<Result> {
  try {
    const d = splitSchema.parse(input);
    if (d.debtorId === d.creditorId) return { ok: false, error: "Pick two different people." };
    const w = await wid();
    const db = await getDb();
    const mem = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, w));
    const ids = new Set(mem.map((m) => m.userId));
    if (!ids.has(d.debtorId) || !ids.has(d.creditorId)) return { ok: false, error: "Both people must be members of this tracker." };
    await db.insert(splits).values({ workspaceId: w, note: d.note ?? "", creditorId: d.creditorId, debtorId: d.debtorId, amount: String(d.amount) });
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function settleUp(otherUserId: string): Promise<Result> {
  try {
    const me = await getCurrentUser();
    if (!me) return { ok: false, error: "Not signed in." };
    const w = await wid();
    const db = await getDb();
    await db.update(splits).set({ settledAt: new Date() }).where(and(
      eq(splits.workspaceId, w), isNull(splits.settledAt),
      or(
        and(eq(splits.creditorId, me.id), eq(splits.debtorId, otherUserId)),
        and(eq(splits.creditorId, otherUserId), eq(splits.debtorId, me.id)),
      ),
    ));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteSplit(id: string): Promise<Result> {
  try {
    const w = await wid();
    const db = await getDb();
    await db.delete(splits).where(and(eq(splits.id, id), eq(splits.workspaceId, w)));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── tags ─────────────────────────────────────────────────
const TAG_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6"];

/** All tags in the active workspace (read; used by the tag picker). */
export async function listTags(): Promise<{ id: string; name: string; color: string }[]> {
  const w = await getActiveWorkspaceId();
  if (!w) return [];
  const db = await getDb();
  return db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).where(eq(tags.workspaceId, w)).orderBy(tags.name);
}

/** Find-or-create a tag by name (case-sensitive), returns it. */
export async function createTag(input: unknown): Promise<Result<{ id: string; name: string; color: string }>> {
  try {
    const d = z.object({ name: z.string().trim().min(1, "Tag name required").max(40), color: z.string().optional() }).parse(input);
    const w = await wid();
    const db = await getDb();
    const [existing] = await db.select().from(tags).where(and(eq(tags.workspaceId, w), eq(tags.name, d.name))).limit(1);
    if (existing) return { ok: true, data: { id: existing.id, name: existing.name, color: existing.color } };
    const color = d.color || TAG_COLORS[d.name.length % TAG_COLORS.length];
    const [row] = await db.insert(tags).values({ workspaceId: w, name: d.name, color }).returning();
    revalidatePath("/");
    return { ok: true, data: { id: row.id, name: row.name, color: row.color } };
  } catch (e) { return fail(e); }
}

export async function deleteTag(id: string): Promise<Result> {
  try {
    const w = await wid();
    const db = await getDb();
    await db.delete(tags).where(and(eq(tags.id, id), eq(tags.workspaceId, w)));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}
