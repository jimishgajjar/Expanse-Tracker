"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getHouseholdDb } from "./household-db";
import { PlanningError, type PlanningScope } from "./monthly-planning";
import { getSession } from "./session";
import { reopenReimbursement, reviewReimbursement, settleReimbursement } from "./reimbursements";
import type { HouseholdDb } from "./household-db";

async function run<T>(workspace:string, work:(db:HouseholdDb, scope:PlanningScope) => Promise<T>) {
  try {
    const session = await getSession();
    if (!session || session.workspaceId !== workspace) throw new PlanningError("Reopen the household tracker.");
    const db = await getHouseholdDb();
    if (!db) throw new PlanningError("Reimbursements are unavailable on this server.");
    return {ok:true as const, value:await work(db,{workspace,actor:session.user.id})};
  } catch (error) {
    return {ok:false as const,error:error instanceof PlanningError ? error.message : error instanceof ZodError
      ? "Check the selected payment and date." : "Couldn't confirm this reimbursement. Refresh and review the balance."};
  }
}
export async function loadSettlement(workspace:string, peer:string) {
  return run(workspace,(db,scope) => reviewReimbursement(db,scope,peer));
}
export async function confirmSettlement(workspace:string,input:unknown) {
  return run(workspace,async (db,scope) => { await settleReimbursement(db,scope,input); revalidatePath("/","layout"); });
}
export async function reopenSettlement(workspace:string,id:string) {
  return run(workspace,async (db,scope) => { await reopenReimbursement(db,scope,id); revalidatePath("/","layout"); });
}
