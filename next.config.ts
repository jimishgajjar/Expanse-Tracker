import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM binary and must not be bundled by the server compiler.
  // (Neon's driver is pure JS and needs no special handling.)
  serverExternalPackages: ["@electric-sql/pglite", "exceljs", "web-push"],
};

export default nextConfig;
