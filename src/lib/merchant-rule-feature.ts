import { hostedHouseholdEnabled } from "./household-features";

export function merchantRulesEnabled() {
  if (hostedHouseholdEnabled()) return true;
  return process.env.NODE_ENV==="development" && !!process.env.PGLITE_PATH && !process.env.DATABASE_URL && !process.env.VERCEL;
}
