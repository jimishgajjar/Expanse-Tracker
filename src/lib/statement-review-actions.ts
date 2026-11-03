"use server";

import { z } from "zod";
import { getDb } from "./db";
import { getCurrentUser } from "./session";
import { getActiveWorkspaceId } from "./workspace";
import { statementReviewsEnabled, statementCorrectionsEnabled } from "./statement-review-feature";
import { listStatementReviews, readStatementReview, saveStatementReview, startStatementReview, recordStatementCorrection, StatementReviewError } from "./statement-review-store";
import { revalidatePath } from "next/cache";

async function context() {
  if (!statementReviewsEnabled()) throw new StatementReviewError("Saved statement reviews are not enabled yet.");
  const [user,workspace] = await Promise.all([getCurrentUser(),getActiveWorkspaceId()]);
  if (!user || !workspace) throw new StatementReviewError("Sign in to access statement reviews.");
  return {db:await getDb(),workspace,actor:{id:user.id,name:user.name||user.email||"Workspace member"}};
}
function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message || "Check the statement details.";
  if (error instanceof StatementReviewError) return error.message;
  return "Could not confirm this review. Reload saved reviews before retrying.";
}
export async function startReview(input: unknown) {
  try { const {db,workspace,actor} = await context(); const id = await startStatementReview(db,workspace,actor,input); return {ok:true as const,review:await readStatementReview(db,workspace,actor.id,id)}; }
  catch(error) { return {ok:false as const,error:errorMessage(error)}; }
}
export async function saveReview(input: unknown) {
  try { const {db,workspace,actor} = await context(); return {ok:true as const,review:await saveStatementReview(db,workspace,actor,input)}; }
  catch(error) { return {ok:false as const,error:errorMessage(error)}; }
}
export async function loadReview(id: string) {
  try { const {db,workspace,actor} = await context(); return {ok:true as const,review:await readStatementReview(db,workspace,actor.id,z.uuid().parse(id))}; }
  catch(error) { return {ok:false as const,error:errorMessage(error)}; }
}
export async function savedReviews(account: string) {
  try { const {db,workspace,actor} = await context(); return {ok:true as const,reviews:await listStatementReviews(db,workspace,actor.id,z.string().min(1).max(128).parse(account))}; }
  catch(error) { return {ok:false as const,error:errorMessage(error)}; }
}
export async function correctStatement(input:unknown) {
  try {
    if(!statementCorrectionsEnabled())throw new StatementReviewError("Recording statement corrections is not enabled.");
    const {db,workspace,actor}=await context();
    const review=await recordStatementCorrection(db,workspace,actor,input);
    revalidatePath("/","layout");
    return {ok:true as const,review};
  } catch(error){return {ok:false as const,error:errorMessage(error)};}
}
