import { randomUUID } from "node:crypto";
import type { HouseholdDb } from "./household-db";
import { isPersonalLedger } from "./household-access";

/** Create an empty ledger only. The caller supplies its authenticated scope. */
export async function openPersonalLedger(db: HouseholdDb, scope: {workspace:string; actor:string}) {
  if (isPersonalLedger(scope.workspace)) throw new Error("Open the household tracker first.");
  return db.transaction(async tx => {
    const {rows:[membership]} = await tx.query<{role:string;name:string}>(`
      SELECT m.role,w.name FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id
      WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.role IN ('owner','member','viewer') FOR UPDATE OF m`,
      [scope.workspace,scope.actor]);
    if (!membership) throw new Error("Current household membership required.");
    const {rows:[existing]} = await tx.query<{id:string}>(
      "SELECT ledger_id AS id FROM personal_ledgers WHERE household_id=$1 AND person_id=$2",[scope.workspace,scope.actor]);
    if (existing) return existing.id;
    if (membership.role === "viewer") throw new Error("Editing access required to create a personal ledger.");
    const id = "personal:" + randomUUID();
    await tx.query("INSERT INTO workspaces(id,name,owner_id) VALUES ($1,$2,$3)",[id,"My private accounts · " + membership.name,scope.actor]);
    await tx.query("INSERT INTO personal_ledgers(ledger_id,household_id,person_id) VALUES ($1,$2,$3)",[id,scope.workspace,scope.actor]);
    // Inherit the display currency, not balances, categories or any household activity.
    await tx.query(`INSERT INTO app_settings(workspace_id,currency_code,digest_enabled)
      SELECT $1,currency_code,false FROM app_settings WHERE workspace_id=$2`,[id,scope.workspace]);
    return id;
  });
}
