import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Auth helper for the RLS tests. Every client here is built with the ANON /
 * publishable key and signed in as an existing SEED account — NEVER the
 * service-role key. RLS is therefore the thing constraining every read and
 * write, which is exactly what the tests are checking (and what keeps them from
 * ever touching real users' data).
 *
 * Seed accounts are seed-<key>@actionseed.test, created by scripts/seed.ts, all
 * sharing SEED_PASSWORD. Clients are cached per key for the lifetime of the test
 * FILE (Vitest isolates files), so we're not re-authenticating on every call.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PASSWORD = process.env.SEED_PASSWORD!;
const SEED_DOMAIN = "actionseed.test";

const clientCache = new Map<string, SupabaseClient>();
const idCache = new Map<string, string>();

/** The seed login email for a key, e.g. "actor-1" → seed-actor-1@actionseed.test */
export function seedEmail(key: string): string {
  return `seed-${key}@${SEED_DOMAIN}`;
}

/**
 * A Supabase client authenticated as seed-<key>. Cached per key. Each client
 * keeps its own in-memory session (no persistence), so different keys stay
 * distinct callers — which is how we assert "A can, B can't".
 */
export async function signInAs(key: string): Promise<SupabaseClient> {
  const cached = clientCache.get(key);
  if (cached) return cached;

  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: seedEmail(key),
    password: PASSWORD,
  });
  if (error || !data.user) {
    throw new Error(
      `signInAs(${key}) failed: ${error?.message ?? "no user"}. ` +
        `Has the seed run (npm run seed) and is SEED_PASSWORD correct?`
    );
  }
  clientCache.set(key, client);
  idCache.set(key, data.user.id);
  return client;
}

/**
 * The profile id (== auth user id) of a seed account. Signs the account in if
 * needed. Handy for building rows and asserting ownership.
 */
export async function getProfileId(key: string): Promise<string> {
  const cached = idCache.get(key);
  if (cached) return cached;
  await signInAs(key);
  return idCache.get(key)!;
}
