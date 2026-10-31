/** Fail closed: this simulator is never available on Vercel or a remote database. */
export function bankDemoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.BANK_SYNC_MODE === "demo" &&
    env.NODE_ENV === "development" &&
    !env.DATABASE_URL &&
    !env.VERCEL &&
    !!env.PGLITE_PATH
  );
}
