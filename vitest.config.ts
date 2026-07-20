import { defineConfig } from "vitest/config";

// Layer 1 — RLS / integration tests. These hit the SHARED Supabase instance over
// the network, acting only as seed accounts (see the safety model in the tests).
// So: run files serially (no parallelism) to avoid two files racing on the same
// shared seed rows, and give network round-trips generous timeouts. The Playwright
// E2E suite (tests/e2e/*.spec.ts) is deliberately EXCLUDED here — it runs via
// `npm run test:e2e`, not `npm test`.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
