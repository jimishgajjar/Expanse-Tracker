import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    // Each database suite migrates a fresh Postgres; under a full parallel run on a
    // slow disk that setup, and key-derivation tests, can exceed the 5-10s defaults.
    hookTimeout: 60_000,
    testTimeout: 30_000,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "mobile/src/lib/**/*.test.ts"],
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
