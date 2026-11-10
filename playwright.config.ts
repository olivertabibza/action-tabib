import { defineConfig, devices } from "@playwright/test";
import { loadTestEnv } from "./tests/helpers/load-test-env";

// Layer 2 — thin E2E smoke. LOCAL ONLY (not run in CI: it needs a live server +
// seed data + secrets). Logs in ONCE in global setup and reuses that session via
// storageState, so no test logs in and out. Asserts UI truths only — never RLS.
// Loads .env.test.local (the TEST project) and throws if it's missing locally.
loadTestEnv();

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 30_000,
  use: {
    baseURL,
    // Reuse the session captured in global setup — this is the whole point.
    storageState: "tests/e2e/.auth/state.json",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Always boots its own `next dev`, which inherits the TEST env loaded above
  // (Next never overrides vars already in process.env, so .env.local's
  // production values don't apply). Never reuse a running server: one you
  // started with `npm run dev` is on production. Stop it first if port 3000 is
  // taken.
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
