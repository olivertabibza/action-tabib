import { config } from "dotenv";

// The seed script loads env via tsx's --env-file=.env.local; Vitest doesn't, so
// we load the same file here. Matches scripts/seed.ts's source of truth. Tests
// only ever need the PUBLIC url + anon key and the shared SEED_PASSWORD — never
// the secret/service-role key (that stays out of the test process entirely).
config({ path: ".env.local" });

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SEED_PASSWORD",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  throw new Error(
    `Missing env for tests: ${missing.join(", ")}. ` +
      `Add them to .env.local (see .env.local.example). SEED_PASSWORD must match ` +
      `the shared seed password in scripts/seed.ts.`
  );
}
