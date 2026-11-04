import type { NextConfig } from "next";
import {resolve} from "node:path";

const nextConfig: NextConfig = {
  distDir: !process.env.DATABASE_URL && process.env.PGLITE_PATH===resolve(".pglite-pilot-preview") ? (process.env.NODE_ENV==="development"?".next-pilot":".next-pilot-build")
    : !process.env.DATABASE_URL && process.env.PGLITE_PATH===resolve(".pglite-finance-preview") ? ".next-finance"
    : process.env.PGLITE_PATH === resolve(".pglite-bank-preview") && process.env.NODE_ENV === "development" ? ".next-bank" : ".next",
  // PGlite ships a WASM binary and must not be bundled by the server compiler.
  // (Neon's driver is pure JS and needs no special handling.)
  serverExternalPackages: ["@electric-sql/pglite", "exceljs", "web-push"],
};

export default nextConfig;
