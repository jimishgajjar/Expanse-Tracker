import { spawn } from "node:child_process";
import { join } from "node:path";

// Explicit opt-in sandbox: Next must never load production credentials from .env.
const env = {
  ...process.env,
  DATABASE_URL: "",
  PGLITE_PATH: join(process.cwd(), ".pglite-preview"),
  RESEND_API_KEY: "",
  SMTP_PASS: "",
  VAPID_PRIVATE_KEY: "",
  APP_URL: "http://localhost:3107",
};
const command =
  process.argv[2] === "build"
    ? ["build"]
    : ["dev", "--hostname", "127.0.0.1", "--port", "3107"];
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
