"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "./db";
import { getCurrentUser } from "./session";
import { getActiveRole, getActiveWorkspaceId } from "./workspace";
import { canEditSharedLedger } from "./household-access";
import { convertToTransfer, moveToOpeningBalance, transferCandidates, type ConvertResult, type Scope } from "./convert-transfer";

async function scope(): Promise<Scope> {
  const [workspace, user] = await Promise.all([getActiveWorkspaceId(), getCurrentUser()]);
  if (!workspace || !user) throw new Error("You're not signed in.");
  if (!canEditSharedLedger(await getActiveRole())) throw new Error("You do not have editing access to this tracker.");
  return { workspace, actor: user.id, name: user.name || user.email };
}
function failure(e: unknown): ConvertResult {
  // Receipts, comments, refund links and reimbursements protect an entry from removal.
  if (e instanceof Error && /foreign key|violates|_fk/i.test(`${e.message} ${e.cause instanceof Error ? e.cause.message : ""}`))
    return { ok: false, error: "This entry has a receipt, comment, refund link or reimbursement attached. Remove that first, then convert it." };
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

export async function findTransferCandidates(id: string) {
  try { return await transferCandidates(await getDb(), await scope(), z.string().min(1).parse(id)); }
  catch { return []; }
}

const convertSchema = z.object({ id: z.string().min(1), otherAccountId: z.string().min(1), counterpartId: z.string().min(1).nullable() });
export async function convertEntryToTransfer(input: unknown): Promise<ConvertResult> {
  try {
    const result = await convertToTransfer(await getDb(), await scope(), convertSchema.parse(input));
    if (result.ok) revalidatePath("/");
    return result;
  } catch (e) { return failure(e); }
}

export async function moveEntryToOpeningBalance(id: string): Promise<ConvertResult> {
  try {
    const result = await moveToOpeningBalance(await getDb(), await scope(), z.string().min(1).parse(id));
    if (result.ok) revalidatePath("/");
    return result;
  } catch (e) { return failure(e); }
}
