"use server";

import { getHouseholdDb } from "./household-db";
import { getSession, setActiveWorkspace } from "./session";
import { getActiveWorkspaceId } from "./workspace";
import { householdFeaturesEnabled } from "./household-features";
import { openPersonalLedger } from "./personal-ledger";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { deletePersonalLedger, PersonalLedgerDeletionError } from "./delete-personal-ledger";

export async function deletePrivateTracker(input: unknown) {
  if (!householdFeaturesEnabled()) return { ok: false, error: "Private accounts are unavailable on this server." };
  const parsed = z.object({ workspace: z.string().min(1).max(128), confirmation: z.string().min(1).max(250) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Type the full tracker name to confirm deletion." };
  const session = await getSession();
  if (!session || parsed.data.workspace !== await getActiveWorkspaceId()) {
    return { ok: false, error: "Reopen the private tracker you want to delete first." };
  }
  const db = await getHouseholdDb();
  if (!db) return { ok: false, error: "Private account storage is unavailable." };
  try {
    await deletePersonalLedger(db, { workspace: parsed.data.workspace, actor: session.user.id }, parsed.data.confirmation);
  } catch (error) {
    return { ok: false, error: error instanceof PersonalLedgerDeletionError ? error.message
      : "Could not confirm deletion. Reload this tracker to check its status before trying again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function enterPersonalTracker(household: string) {
  if (!householdFeaturesEnabled()) return { ok: false, error: "Private accounts are unavailable on this server." };
  const session = await getSession();
  if (!session || household !== await getActiveWorkspaceId()) return { ok: false, error: "Reopen the household tracker first." };
  const db = await getHouseholdDb();
  if (!db) return { ok: false, error: "Private account storage is unavailable." };
  try {
    const id = await openPersonalLedger(db, { workspace: household, actor: session.user.id });
    await setActiveWorkspace(id);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not open your private accounts. Reopen the household and check your access." };
  }
}
