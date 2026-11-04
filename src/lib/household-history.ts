import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppDb } from "./db";
import { transactionHistory, transactions, users, workspaceMembers, workspaces } from "./db/schema";
import { canEditSharedLedger, householdRoles, isPersonalLedger } from "./household-access";

const visibleFields = ["amount", "type", "date", "note", "account_id", "category_id", "tag_ids"] as const;
function displayFields(snapshot: Record<string, unknown>) {
  return Object.fromEntries(visibleFields.filter(key => key in snapshot).map(key => [key, snapshot[key]]));
}

/** Anchor even an empty history to a real entry and the reader's current membership.
 * Creator is attribution only; editing a household entry never changes its audience. */
export async function readHouseholdHistory(db: AppDb, workspace: string, reader: string, id: string) {
  const rows = await db.select({
    tracker: workspaces.name, role: workspaceMembers.role, author: users.name, authorEmail: users.email,
    revision: transactionHistory.id, actor: transactionHistory.actorName, at: transactionHistory.createdAt,
    before: transactionHistory.before, after: transactionHistory.after,
  }).from(transactions)
    .innerJoin(workspaces, eq(workspaces.id, transactions.workspaceId))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, reader),
      inArray(workspaceMembers.role, householdRoles)))
    .leftJoin(users, eq(users.id, transactions.createdBy))
    .leftJoin(transactionHistory, and(eq(transactionHistory.transactionId, transactions.id), eq(transactionHistory.workspaceId, workspaces.id)))
    .where(and(eq(transactions.id, id), eq(workspaces.id, workspace)))
    .orderBy(desc(transactionHistory.createdAt), desc(transactionHistory.id)).limit(100);
  const first = rows[0];
  if (!first) return null;
  return {
    access: { recordedBy: first.author || first.authorEmail || null, tracker: first.tracker, canEdit: canEditSharedLedger(first.role),
      ...(isPersonalLedger(workspace) ? {personal: true} : {}) },
    history: rows.flatMap(row => {
      if (!row.revision || !row.at || !row.before || !row.after) return [];
      const creation = row.after._creation;
      const reason = creation && typeof creation === "object" && "source" in creation && creation.source === "statement_correction"
        && "reason" in creation && typeof creation.reason === "string" ? creation.reason : null;
      return [{id: row.revision, actorName: row.actor, createdAt: row.at.toISOString(), created: !!creation, correctionReason: reason,
        before: displayFields(row.before), after: displayFields(row.after)}];
    }),
  };
}

export type HouseholdHistory = NonNullable<Awaited<ReturnType<typeof readHouseholdHistory>>>;
