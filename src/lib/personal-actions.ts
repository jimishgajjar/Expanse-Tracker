"use server";

import { getHouseholdDb } from "./household-db";
import { getSession, setActiveWorkspace } from "./session";
import { getActiveWorkspaceId } from "./workspace";
import { householdFeaturesEnabled } from "./household-features";
import { openPersonalLedger } from "./personal-ledger";

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
