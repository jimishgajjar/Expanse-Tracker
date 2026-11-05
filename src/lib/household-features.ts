import { personalPreviewEnabled } from "./personal-preview";

// Opt-in is deliberate. A preview deployment may only use a dedicated rehearsal database.
export function hostedHouseholdEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (!env.DATABASE_URL) return false;
  if (env.VERCEL_ENV === "production") return env.HOUSEHOLD_RELEASE === "production";
  if (env.HOUSEHOLD_RELEASE !== "staging") return false;
  try {
    const target = new URL(env.DATABASE_URL);
    if (!["postgresql:", "postgres:"].includes(target.protocol) || !target.hostname.endsWith(".neon.tech")) return false;
    if (/^\/m7_rehearsal_[a-f0-9]{32}$/.test(target.pathname)) return true;
    return env.VERCEL_ENV === "preview" && env.PILOT_SETUP === "1"
      && env.REVIEWED_FILE_IMPORTS === "1" && env.STATEMENT_REVIEWS_ENABLED === "1"
      && /^\/m10_rehearsal_[a-f0-9]{32}$/.test(target.pathname);
  } catch { return false; }
}

export function householdFeaturesEnabled() {
  return personalPreviewEnabled() || hostedHouseholdEnabled();
}

export function sameHouseholdOrigin(req: Request) {
  const url = new URL(req.url);
  return req.headers.get("host") === url.host && req.headers.get("origin") === url.origin;
}
