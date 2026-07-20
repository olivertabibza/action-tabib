import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Layer 2 — thin E2E smoke. LOCAL ONLY (not run in CI: it needs a live server +
// seed data + secrets). Logs in ONCE in global setup and reuses that session via
// storageState, so no test logs in and out. Asserts UI truths only — never RLS.
config({ path: ".env.local" });

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
  // Boots `next dev` if nothing's already serving. Next auto-loads .env.local.
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
