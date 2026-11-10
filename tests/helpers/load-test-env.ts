import { existsSync } from "node:fs";
import { config } from "dotenv";

const TEST_ENV_FILE = ".env.test.local";

/**
 * Load the TEST Supabase project's env for Vitest and Playwright.
 *
 * Outside CI, .env.test.local must exist: there is deliberately no fallback to
 * .env.local, which points at production, so the tests can never silently run
 * against it. In CI (process.env.CI set) the file doesn't exist and the vars
 * come from the workflow's env: block instead. dotenv never overwrites vars
 * already in process.env.
 */
export function loadTestEnv(): void {
  if (existsSync(TEST_ENV_FILE)) {
    config({ path: TEST_ENV_FILE });
    return;
  }
  if (!process.env.CI) {
    throw new Error(
      `${TEST_ENV_FILE} is missing. The tests run only against the TEST ` +
        `Supabase project and never fall back to .env.local (production). ` +
        `Copy .env.test.local.example to ${TEST_ENV_FILE} and fill it in.`
    );
  }
}
