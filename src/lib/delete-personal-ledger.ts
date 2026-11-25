import type { HouseholdDb } from "./household-db";
import { isPersonalLedger } from "./household-access";

export class PersonalLedgerDeletionError extends Error {}

/** Delete only an explicitly confirmed private ledger belonging to this actor. */
export async function deletePersonalLedger(
  db: HouseholdDb,
  scope: { workspace: string; actor: string },
  confirmation: string,
) {
  if (!isPersonalLedger(scope.workspace)) {
    throw new PersonalLedgerDeletionError("Only a private tracker can be deleted here.");
  }
  return db.transaction(async tx => {
    const { rows: [ledger] } = await tx.query<{ name: string }>(`
      SELECT w.name FROM personal_ledgers p
      JOIN workspaces w ON w.id=p.ledger_id AND w.owner_id=p.person_id
      JOIN workspace_members m ON m.workspace_id=p.household_id AND m.user_id=p.person_id
      WHERE p.ledger_id=$1 AND p.person_id=$2 AND m.role IN ('owner','member')
      FOR UPDATE OF m,p,w`, [scope.workspace, scope.actor]);
    if (!ledger) throw new PersonalLedgerDeletionError("Reopen your own private tracker with editing access before deleting it.");
    if (confirmation !== ledger.name) throw new PersonalLedgerDeletionError("Type the full tracker name exactly to confirm deletion.");

    // Lock parent rows so a concurrent foreign-key insert cannot slip between
    // the boundary check and deletion. Do not cascade into another tracker,
    // including malformed legacy references that normal write paths now reject.
    for (const table of ["accounts", "categories", "tags", "transactions", "transfers", "goals"]) {
      await tx.query(`SELECT id FROM ${table} WHERE workspace_id=$1 ORDER BY id FOR UPDATE`, [scope.workspace]);
    }
    const { rows: foreignKeys } = await tx.query<{ child: string; parent: string; child_column: string; parent_column: string }>(`
      SELECT child.relname AS child, parent.relname AS parent,
        ca.attname AS child_column, pa.attname AS parent_column
      FROM pg_constraint fk
      JOIN pg_class child ON child.oid=fk.conrelid
      JOIN pg_class parent ON parent.oid=fk.confrelid
      JOIN pg_namespace ns ON ns.oid=child.relnamespace
      JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=fk.conkey[1]
      JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=fk.confkey[1]
      WHERE fk.contype='f' AND ns.nspname='public' AND cardinality(fk.conkey)=1
        AND parent.relname IN ('accounts','categories','tags','transactions','transfers','goals')
        AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=child.oid AND a.attname='workspace_id' AND NOT a.attisdropped)`);
    // Identifiers come only from PostgreSQL's schema, never from request input.
    const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
    const checks = foreignKeys.map(fk => `SELECT 1 FROM ${quote(fk.child)} c
      JOIN ${quote(fk.parent)} p ON c.${quote(fk.child_column)}=p.${quote(fk.parent_column)}
      WHERE p.workspace_id=$1 AND c.workspace_id<>$1`);
    checks.push(`SELECT 1 FROM transaction_tags l JOIN tags p ON p.id=l.tag_id
      JOIN transactions c ON c.id=l.transaction_id WHERE p.workspace_id=$1 AND c.workspace_id<>$1`);
    checks.push(`SELECT 1 FROM purchase_allocations l JOIN categories p ON p.id=l.category_id
      JOIN transactions c ON c.id=l.transaction_id WHERE p.workspace_id=$1 AND c.workspace_id<>$1`);
    checks.push(`SELECT 1 FROM account_shares s JOIN accounts a ON a.id=s.account_id
      WHERE a.workspace_id=$1 AND s.ledger_id<>$1`);
    if ((await tx.query(`SELECT 1 FROM (${checks.join(" UNION ALL ")}) linked LIMIT 1`, [scope.workspace])).rows.length) {
      throw new PersonalLedgerDeletionError("Deletion paused because another tracker references this data. Nothing was deleted.");
    }

    // Remove restricted dependants before their parents. Each delete is scoped,
    // and any unexpected constraint failure rolls the entire operation back.
    for (const table of ["finance_bookings", "finance_operations", "finance_accounts",
      "refund_links", "reimbursements", "goal_reservations", "annual_goal_plans",
      "goal_opening_reviews", "monthly_plans", "pay_period_plans", "budget_moves"]) {
      await tx.query(`DELETE FROM ${table} WHERE workspace_id=$1`, [scope.workspace]);
    }
    // These attachments deliberately restrict individual transaction deletion.
    // Whole-tracker deletion explicitly includes them, within the same transaction.
    for (const table of ["receipt_images", "transaction_comments", "purchase_allocations"]) {
      await tx.query(`DELETE FROM ${table} WHERE transaction_id IN
        (SELECT id FROM transactions WHERE workspace_id=$1)`, [scope.workspace]);
    }
    await tx.query("DELETE FROM workspaces WHERE id=$1 AND owner_id=$2", [scope.workspace, scope.actor]);
    // Existing FK actions clear every session pointing at the deleted tracker.
    // Leave them unselected: stale forms must never be redirected into the household.
  });
}
