import { resolve } from "node:path";
export function sandboxInboxEnabled(env:NodeJS.ProcessEnv=process.env){
  return env.BANK_TOOLS_ENABLED==="1" && env.NODE_ENV==="development" && env.BANK_LOCAL_LINK==="1" && !env.VERCEL && !env.DATABASE_URL &&
    env.PGLITE_PATH===resolve(".pglite-bank-preview") && !!env.PLAID_SANDBOX_CLIENT_ID && !!env.PLAID_SANDBOX_SECRET && !!env.BANK_LOCAL_KEY;
}
