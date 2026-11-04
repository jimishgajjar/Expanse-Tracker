"use server";

import { editWithHistory } from "./transaction-edit";
import { canEditSharedLedger, householdRoles } from "./household-access";
import { createWithHistory, TransactionCreateError } from "./transaction-create";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import { accounts, appSettings, budgets, categories, goals, recurring, splits, tags, transactions, transfers, workspaceMembers } from "./db/schema";
import { assertWorkspaceReferences } from "./workspace-references";
import { findCurrencyByCode } from "./currencies";
import { getActiveRole, getActiveWorkspaceId, getUserWorkspaces } from "./workspace";
import { getCurrentUser, setActiveWorkspace } from "./session";
import { categoriesForNote } from "./category-history";
import {allocationSchema} from "./purchase-allocation";
import {merchantRulesEnabled} from "./merchant-rule-feature";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof Error && e.cause instanceof Error && e.cause.message.includes("transaction_comments_transaction_id_transactions_id_fk"))
    return {ok:false,error:"This entry has comments. The authors or tracker owner can remove them from Activity before deleting the entry or account."};
  if (e instanceof Error && e.cause instanceof Error &&
      (/Unlink the refund/.test(e.cause.message) || /refund_links_(credit|purchase)_id_transactions_id_fk/.test(e.cause.message))) {
    return {ok:false,error:"Open the incoming credit in Activity and unlink its refund before changing or deleting the linked purchase or credit."};
  }
  if (e instanceof Error && e.cause instanceof Error && /Reopen the reimbursement|reimbursements_(transaction|transfer)_id_/.test(e.cause.message))
    return {ok:false,error:"Reopen the reimbursement in Shared expenses before changing or deleting its payment."};
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

/** Active workspace id, or throw (→ {ok:false}). Every mutation is scoped to it,
 *  and view-only members are blocked from writing. */
async function wid(): Promise<string> {
  const id = await getActiveWorkspaceId();
  if (!id) throw new Error("You're not signed in.");
  if (!canEditSharedLedger(await getActiveRole())) throw new Error("You do not have editing access to this tracker.");
  return id;
}

// ── accounts ─────────────────────────────────────────────
export async function lookupCategoryHistory(input: unknown) {
  const parsed = z.object({
    note: z.string().trim().min(2).max(200),
    type: z.enum(["income", "expense"]),
    accountId: z.string().min(1).max(128),
  }).safeParse(input);
  if (!parsed.success) return { ok: false as const };
  try {
    const workspace = await wid();
    const { accountId, type, note } = parsed.data;
    return { ok: true as const, rows: await categoriesForNote(await getDb(), workspace, accountId, type, note) };
  } catch {
    return { ok: false as const };
  }
}

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
    if(d.kind==="income"&&merchantRulesEnabled()&&await categoryUsedInPurchase(db,w,id))
      return {ok:false,error:"Reassign this category on split purchases before changing it to income."};
    await db.update(categories).set(d).where(and(eq(categories.id, id), eq(categories.workspaceId, w)));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteCategory(id: string): Promise<Result> {
  try {
    const w = await wid();
    const db = await getDb();
    if(merchantRulesEnabled()&&await categoryUsedInPurchase(db,w,id))
      return {ok:false,error:"Reassign this category on split purchases before deleting it."};
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.workspaceId, w)));
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}
async function categoryUsedInPurchase(db:Awaited<ReturnType<typeof getDb>>,workspace:string,id:string){
  const result=await db.execute(sql`SELECT 1 FROM purchase_allocations p JOIN transactions t ON t.id=p.transaction_id
    WHERE p.category_id=${id} AND t.workspace_id=${workspace} LIMIT 1`);
  return result.rows.length>0;
}

// ── transactions ─────────────────────────────────────────
const txSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  note: z.string().trim().max(200).default(""),
  accountId: z.string().min(1, "Pick an account"),
  categoryId: z.string().min(1).nullable().optional(),
  tagIds: z.array(z.string()).transform((ids) => [...new Set(ids)]).optional(),
});

export async function createTransaction(input: unknown): Promise<Result<{ id: string; replayed: boolean }>> {
  try {
    if(input && typeof input==="object" && "allocations" in input && input.allocations!==undefined && !merchantRulesEnabled())
      return {ok:false,error:"Split purchases are unavailable in this workspace."};
    const w = await wid();
    const me = await getCurrentUser();
    if (!me) return { ok: false, error: "Sign in again." };
    const db = await getDb();
    const ctx=z.object({draft:z.object({workspace:z.string(),actor:z.string(),version:z.number().int().positive()}).optional()}).parse(input).draft;
    if(ctx && (!merchantRulesEnabled()||ctx.workspace!==w||ctx.actor!==me.id))return {ok:false,error:"Reopen this draft in its original workspace."};
    const data = await createWithHistory(db, w, { id: me.id, name: me.name || me.email || "Workspace member" }, input,ctx?.version);
    revalidatePath("/");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof z.ZodError || e instanceof TransactionCreateError) return fail(e);
    // Database errors can include parameterized financial data. Do not expose them.
    return { ok: false, error: "Couldn't confirm the save. Retry without changing the form, or check Activity first." };
  }
}

export async function updateTransaction(id: string, input: unknown): Promise<Result> {
  try {
    const parts=z.union([z.tuple([]),allocationSchema]);
    const d = txSchema.partial().extend({allocations:parts.optional(),previousAllocations:parts.optional(),expectedRevision:z.string().regex(/^\d{1,10}$/).optional()}).parse(input);
    if(d.allocations && (!merchantRulesEnabled() || !d.previousAllocations))return {ok:false,error:"Reopen this purchase before editing its split."};
    const w = await wid();
    const db = await getDb();
    const me = await getCurrentUser();
    if (!me) return {ok:false,error:"Sign in again."};
    await assertWorkspaceReferences(w, { accountIds: [d.accountId], categoryId: d.categoryId, tagIds: d.tagIds });
    const patch: Record<string,unknown> = {};
    const fields = {type:"type",amount:"amount",date:"date",note:"note",accountId:"account_id",categoryId:"category_id"} as const;
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) if (d[key] !== undefined) patch[fields[key]] = d[key];
    const updated = await editWithHistory(db,w,id,{id:me.id,name:me.name || me.email},patch,d.tagIds,
      d.allocations?{lines:d.allocations,previous:d.previousAllocations!}:undefined,merchantRulesEnabled(),d.expectedRevision);
    if (!updated) return {ok:false,error:"Couldn’t update this purchase. Refresh and check its current categories and amounts."};
    revalidatePath("/");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteTransaction(id: string, expectedRevision?: string): Promise<Result> {
  try {
    const w = await wid();
    const me = await getCurrentUser();
    if (!me) return { ok: false, error: "Not signed in." };
    const db = await getDb();
    if(merchantRulesEnabled()&&(await db.execute(sql`SELECT 1 FROM receipt_images r JOIN transactions t ON t.id=r.transaction_id
      WHERE t.id=${id} AND t.workspace_id=${w}`)).rows.length)return {ok:false,error:"Remove the attached receipt before deleting this transaction. Download a copy first if you want to keep it."};
    const removed = await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.workspaceId, w),
      expectedRevision===undefined?undefined:sql`transactions.xmin::text=${expectedRevision}`,
      sql`EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id=${w} AND user_id=${me.id} AND role IN ('owner','member') FOR SHARE)`))
      .returning({ id: transactions.id });
    if (!removed.length) return { ok:false, error:"Transaction unavailable or editing access was removed." };
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
    await assertWorkspaceReferences(w, { categoryId: d.categoryId });
    await db
      .insert(budgets)
      .values({ workspaceId: w, categoryId: d.categoryId, amount: String(d.amount) })
      .onConflictDoUpdate({ target: budgets.categoryId, set: { amount: String(d.amount) }, setWhere: eq(budgets.workspaceId, w) });
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
    await assertWorkspaceReferences(w, { accountIds: [d.fromAccountId, d.toAccountId] });
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
  tagIds: z.array(z.string().min(1)).max(50).transform((ids) => [...new Set(ids)]).optional(),
}).refine((d) => !d.endDate || d.endDate >= d.nextDate, { message: "End date must be after the start date", path: ["endDate"] });

export async function createRecurring(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const d = recurringSchema.parse(input);
    const w = await wid();
    const db = await getDb();
    await assertWorkspaceReferences(w, { accountIds: [d.accountId], categoryId: d.categoryId, tagIds: d.tagIds });
    const [created] = await db.insert(recurring).values({
      workspaceId: w, type: d.type, amount: String(d.amount), note: d.note ?? "",
      accountId: d.accountId, categoryId: d.categoryId ?? null,
      frequency: d.frequency, nextDate: d.nextDate,
      endDate: d.endDate ?? null, maxOccurrences: d.maxOccurrences ?? null,
      alertsEnabled: d.alertsEnabled ?? false, remindDaysBefore: d.remindDaysBefore ?? 1,
      commitmentType: d.commitmentType ?? "other", autoPost: d.autoPost ?? true,
      totalAmount: d.totalAmount != null ? String(d.totalAmount) : null,
      priceHistory: [{ amount: d.amount, at: new Date().toISOString() }],
      tagIds: d.tagIds ?? [],
    }).returning({ id: recurring.id });
    revalidatePath("/");
    return { ok: true, data: { id: created.id } };
  } catch (e) { return fail(e); }
}

export async function updateRecurring(id: string, input: unknown): Promise<Result<{ id: string }>> {
  try {
    const d = recurringSchema.parse(input);
    const w = await wid();
    const db = await getDb();
    await assertWorkspaceReferences(w, { accountIds: [d.accountId], categoryId: d.categoryId, tagIds: d.tagIds });
    const [cur] = await db.select().from(recurring).where(and(eq(recurring.id, id), eq(recurring.workspaceId, w))).limit(1);
    if (!cur) return { ok: false, error: "Subscription not found." };

    // Log a price-change entry whenever the amount changes. Future occurrences
    // post at the current amount (processRecurring reads it), so editing the
    // price also updates the next charge.
    let priceHistory = cur.priceHistory ?? [];
    const oldAmount = Number(cur.amount);
    if (d.amount !== oldAmount) {
      if (priceHistory.length === 0) priceHistory = [{ amount: oldAmount, at: (cur.createdAt ?? new Date()).toISOString() }];
      priceHistory = [...priceHistory, { amount: d.amount, at: new Date().toISOString() }];
    }

    await db.update(recurring).set({
      type: d.type, amount: String(d.amount), note: d.note ?? "",
      accountId: d.accountId, categoryId: d.categoryId ?? null,
      frequency: d.frequency, nextDate: d.nextDate,
      endDate: d.endDate ?? null, maxOccurrences: d.maxOccurrences ?? null,
      alertsEnabled: d.alertsEnabled ?? false, remindDaysBefore: d.remindDaysBefore ?? 1,
      commitmentType: d.commitmentType ?? "other", autoPost: d.autoPost ?? true,
      totalAmount: d.totalAmount != null ? String(d.totalAmount) : null,
      priceHistory,
      ...(d.tagIds !== undefined ? { tagIds: d.tagIds } : {}),
    }).where(and(eq(recurring.id, id), eq(recurring.workspaceId, w)));
    revalidatePath("/");
    return { ok: true, data: { id } };
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

export async function createGoal(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const d = goalSchema.parse(input);
    const w = await wid();
    const db = await getDb();
    const [created] = await db.insert(goals).values({
      workspaceId: w, name: d.name, targetAmount: String(d.targetAmount),
      savedAmount: String(d.savedAmount ?? 0), deadline: d.deadline ?? null, color: d.color || "#047857",
    }).returning({ id: goals.id });
    revalidatePath("/");
    return { ok: true, data: { id: created.id } };
  } catch (e) { return fail(e); }
}

export async function contributeGoal(id: string, amount: number): Promise<Result> {
  try {
    if(merchantRulesEnabled())return {ok:false,error:"Use Planning to reserve or release cash from an account."};
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
    if(merchantRulesEnabled()&&(await db.execute(sql`SELECT 1 FROM goal_reservations WHERE goal_id=${id} AND workspace_id=${w} LIMIT 1`)).rows.length)
      return {ok:false,error:"This goal has reservation history. Release any remaining funds in Planning."};
    if(merchantRulesEnabled()&&(await db.execute(sql`SELECT 1 FROM goal_opening_reviews WHERE goal_id=${id} AND workspace_id=${w} LIMIT 1`)).rows.length)
      return {ok:false,error:"This goal has recorded opening reviews and must be retained for its history."};
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
    const mem = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, w), inArray(workspaceMembers.role, householdRoles)));
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
    const removed = await db.delete(splits).where(and(eq(splits.id, id), eq(splits.workspaceId, w), isNull(splits.settledAt))).returning({id:splits.id});
    if (!removed.length) return {ok:false,error:"This item was already settled or removed. Refresh shared expenses."};
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

export async function renameTag(id: string, input: unknown): Promise<Result> {
  try {
    const d = z.object({ name: z.string().trim().min(1, "Tag name required").max(40) }).parse(input);
    const w = await wid();
    const db = await getDb();
    const [dup] = await db.select().from(tags).where(and(eq(tags.workspaceId, w), eq(tags.name, d.name))).limit(1);
    if (dup && dup.id !== id) return { ok: false, error: "A tag with that name already exists." };
    await db.update(tags).set({ name: d.name }).where(and(eq(tags.id, id), eq(tags.workspaceId, w)));
    revalidatePath("/");
    return { ok: true };
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
