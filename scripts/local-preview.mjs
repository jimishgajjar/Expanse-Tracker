import { spawn } from "node:child_process";
import { join } from "node:path";
import { sandboxEnvironment } from "./bank-sandbox-env.mjs";
const pilot = ["pilot","build-pilot"].includes(process.argv[2]);
const bank = process.argv[2] === "bank";
const finance = ["finance","debt","build-finance"].includes(process.argv[2]);
const port = pilot ? "3140" : finance ? "3138" : bank ? "3122" : "3107";

// Explicit opt-in sandbox: Next must never load production credentials from .env.
const env = {
  ...process.env,
  ...(process.argv[2] === "build-pilot" ? {CIRCLE_NODE_TOTAL:"3"} : {}),
  DATABASE_URL: "",
  PGLITE_PATH: join(process.cwd(), pilot ? ".pglite-pilot-preview" : finance ? ".pglite-finance-preview" : bank ? ".pglite-bank-preview" : ".pglite-preview"),
  FINANCE_DEBT_ONLY: process.argv[2] === "debt" ? "1" : "",
  RESEND_API_KEY: "",
  SMTP_PASS: "",
  VAPID_PRIVATE_KEY: "",
  BANK_SYNC_MODE: "demo",
  STATEMENT_REVIEWS_ENABLED: "1",
  STATEMENT_CORRECTIONS_ENABLED: "1",
  REVIEWED_FILE_IMPORTS: "1",
  PLAID_CLIENT_ID: "",
  PLAID_SECRET: "",
  PLAID_SANDBOX_SECRET: "", PLAID_SANDBOX_CLIENT_ID: "", BANK_LOCAL_LINK: "", BANK_LOCAL_KEY: "",
  ...(bank && process.env.BANK_TOOLS_ENABLED === "1" ? sandboxEnvironment() : {}),
  APP_URL: "http://127.0.0.1:"+port,
};
const command =
  ["build","build-finance","build-pilot"].includes(process.argv[2])
    ? ["build", ...(finance || pilot?["--webpack"]:[])]
    : process.argv[2] === "start"
      ? ["start", "--hostname", "127.0.0.1", "--port", "3107"]
      : ["dev", ...(finance || pilot ? ["--webpack"] : []), "--hostname", "127.0.0.1", "--port", port];
console.log(
  "Isolated preview: embedded demo database; external database, email and push disabled.",
);
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", ...command],
  { env, stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 1));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
