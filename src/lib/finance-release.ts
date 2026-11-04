import { hostedHouseholdDb } from "./household-db";
import { localPersonalDb } from "./local-personal-db";
import { personalPreviewEnabled } from "./personal-preview";

export function hostedFinanceRelease(env:NodeJS.ProcessEnv) {
  const mode=env.FINANCE_RELEASE;
  if ((mode!=="debt" && mode!=="currencies") || !env.DATABASE_URL) return null;
  if (env.VERCEL_ENV==="production") return env.FINANCE_ENABLE_PRODUCTION==="yes" ? mode:null;
  if (env.VERCEL_ENV!=="preview") return null;
  try {
    const target=new URL(env.DATABASE_URL);
    return ["postgres:","postgresql:"].includes(target.protocol) && target.hostname.endsWith(".neon.tech") &&
      /^\/m8_rehearsal_[a-f0-9]{32}$/.test(target.pathname) ? mode:null;
  } catch {return null;}
}

export function financeRelease() {
  if (personalPreviewEnabled()) return process.env.FINANCE_DEBT_ONLY==="1"?"debt":"currencies";
  return hostedFinanceRelease(process.env);
}

export async function financeDatabase() {
  if (!financeRelease()) return null;
  return personalPreviewEnabled()?localPersonalDb():hostedHouseholdDb(process.env.DATABASE_URL!);
}
