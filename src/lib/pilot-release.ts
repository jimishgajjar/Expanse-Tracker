import { personalPreviewEnabled } from "./personal-preview";
import { hostedHouseholdEnabled } from "./household-features";
import type { HouseholdDb } from "./household-db";

export function pilotAvailable() {
  if (personalPreviewEnabled()) return true;
  if (process.env.PILOT_SETUP !== "1" || process.env.REVIEWED_FILE_IMPORTS!=="1" || process.env.STATEMENT_REVIEWS_ENABLED!=="1") return false;
  if (process.env.VERCEL_ENV === "production") return hostedHouseholdEnabled();
  if (process.env.VERCEL_ENV !== "preview") return false;
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return ["postgres:", "postgresql:"].includes(url.protocol) && url.hostname.endsWith(".neon.tech") &&
      /^\/m10_rehearsal_[a-f0-9]{32}$/.test(url.pathname);
  } catch { return false; }
}

export async function pilotDatabase():Promise<HouseholdDb|null> {
  if (!pilotAvailable()) return null;
  if (personalPreviewEnabled()) return (await import("./local-personal-db")).localPersonalDb();
  return (await import("./household-db")).hostedHouseholdDb(process.env.DATABASE_URL!);
}
