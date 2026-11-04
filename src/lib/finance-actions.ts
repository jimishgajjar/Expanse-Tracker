"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { getActiveWorkspaceId } from "./workspace";
import { financeDatabase,financeRelease } from "./finance-release";
import { applyFinance } from "./finance-posting";
import { ZodError } from "zod";

export async function saveFinance(workspace:string,command:unknown) {
  const [session,active,db]=await Promise.all([getSession(),getActiveWorkspaceId(),financeDatabase()]);
  if (!db || !session || workspace!==active) return {error:"Reopen the intended tracker and try again."};
  try {
    await applyFinance(db,{workspace,actor:session.user.id},command,financeRelease()==="debt");
  } catch (e) {
    if (e instanceof ZodError) return {error:"Check "+e.issues.map(i=>i.path.join(".")).join(", ")+"."};
    if (e instanceof Error && !("code" in e)) return {error:e.message};
    return {error:"Could not save. Check whether this entry or statement has already been recorded."};
  }
  revalidatePath("/financial-position");
  revalidatePath("/");
  return {error:null};
}
