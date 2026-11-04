import { existsSync,readFileSync } from "node:fs";
import { parse } from "dotenv";
import { checkSandbox } from "../src/lib/plaid-sandbox/check";
import { SandboxError,SandboxProvider } from "../src/lib/plaid-sandbox/provider";

async function main(){
  if(process.env.VERCEL || process.env.NODE_ENV==="production" || process.env.DATABASE_URL?.trim()){
    throw new SandboxError("Refusing to run in a hosted, production or database-connected process.");
  }
  const file=".env.plaid-sandbox.local";
  const config=existsSync(file)?parse(readFileSync(file)):{};
  const clientId=(process.env.PLAID_SANDBOX_CLIENT_ID??config.PLAID_SANDBOX_CLIENT_ID)?.trim();
  const secret=(process.env.PLAID_SANDBOX_SECRET??config.PLAID_SANDBOX_SECRET)?.trim();
  if(!clientId||!secret)throw new SandboxError("Sandbox credentials not configured. See docs/plaid-sandbox.md. No provider request was made.");
  console.log(JSON.stringify(await checkSandbox(new SandboxProvider({clientId,secret})),null,2));
}
main().catch(e=>{
  console.error(e instanceof SandboxError?e.message:"Sandbox check failed. No diagnostic payload was logged.");
  process.exitCode=1;
});
