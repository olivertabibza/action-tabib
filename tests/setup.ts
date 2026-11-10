import { loadTestEnv } from "./helpers/load-test-env";

// The seed script loads env via tsx's --env-file=.env.test.local; Vitest
// doesn't, so we load the same file here. Matches scripts/seed.ts's source of
// truth. Tests only ever need the PUBLIC url + anon key and the shared
// SEED_PASSWORD — never the secret/service-role key (that stays out of the test
// process entirely).
//
// Locally, .env.test.local (the TEST Supabase project) is required and there is
// deliberately no fallback to .env.local, which points at production. In CI the
// file doesn't exist and the vars arrive from the workflow's env: block (the
// test project's secrets), so process.env is the source of truth there.
loadTestEnv();

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SEED_PASSWORD",
] as const;

const missing: string[] = [];
const malformed: string[] = [];
const cleaned = new Map<string, string>();

for (const key of required) {
  // Trim so a secret saved with a trailing newline or stray whitespace still
  // works — the cleaned value is written back to process.env below, because
  // tests/helpers/auth.ts reads process.env directly.
  const value = (process.env[key] ?? "").trim();
  if (!value) {
    missing.push(key);
    continue;
  }
  if (key === "NEXT_PUBLIC_SUPABASE_URL") {
    let ok = false;
    try {
      ok = new URL(value).protocol.startsWith("http");
    } catch {
      ok = false;
    }
    // Catches values pasted with surrounding quotes or other junk that survives
    // trimming — the failure mode that surfaces as "Invalid supabaseUrl".
    if (!ok) {
      malformed.push(key);
      continue;
    }
  }
  cleaned.set(key, value);
}

if (missing.length > 0 || malformed.length > 0) {
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`missing: ${missing.join(", ")}`);
  if (malformed.length > 0)
    parts.push(
      `malformed (present but not a valid http(s) URL — check for surrounding ` +
        `quotes, whitespace, or a trailing newline in the value): ${malformed.join(", ")}`
    );
  throw new Error(
    `Env problem for tests — ${parts.join("; ")}. ` +
      `Locally: add them to .env.test.local (see .env.test.local.example). ` +
      `In CI: set them as Repository secrets (the TEST project's values), ` +
      `referenced by the npm test step's ` +
      `env: block in .github/workflows/test.yml. ` +
      `SEED_PASSWORD is the single source of the seed accounts' password ` +
        `(scripts/seed.ts reads it too).`
  );
}

// Write trimmed values back so downstream readers get the clean value.
for (const [key, value] of cleaned) process.env[key] = value;
