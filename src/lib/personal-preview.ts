import { resolve } from "node:path";

export function personalPreviewEnabled() {
  const path = process.env.PGLITE_PATH;
  return process.env.NODE_ENV === "development" && !process.env.DATABASE_URL && !!path &&
    [".pglite-preview", ".pglite-bank-preview",".pglite-finance-preview",".pglite-pilot-preview"].some(name => resolve(name) === resolve(path));
}
