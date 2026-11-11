import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
 *
 * Sessions are also cached ON DISK (see sessionCacheFile), because the
 * in-memory cache starts empty in every file: each file used to sign every
 * account in again, ~45 password sign-ins per run, which tripped the test
 * project's Auth rate limit ("Request rate limit reached", HTTP 429) late in a
 * run. Now each account signs in once and later files resume its session, and
 * a rate-limited sign-in waits and retries instead of failing the whole file.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PASSWORD = process.env.SEED_PASSWORD!;
const SEED_DOMAIN = "actionseed.test";

/**
 * seed-admin-1's own password (never the shared one — see scripts/seed.ts).
 * Optional: undefined when unset, and tests that need the admin skip visibly.
 */
export const ADMIN_KEY = "admin-1";
export const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD?.trim() || undefined;

const clientCache = new Map<string, SupabaseClient>();
const idCache = new Map<string, string>();

/** The seed login email for a key, e.g. "actor-1" → seed-actor-1@actionseed.test */
export function seedEmail(key: string): string {
  return `seed-${key}@${SEED_DOMAIN}`;
}

/** One account's saved session, enough for auth.setSession(). */
type CachedSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // seconds since the epoch, as Supabase reports it
  user_id: string;
};

/**
 * Per-project cache file in the OS temp folder. It holds short-lived (1 hour)
 * sessions for TEST-project seed accounts only, written owner-read-only. Files
 * run one at a time (vitest.config.ts: fileParallelism false), so plain
 * read-modify-write is enough; the rename keeps a half-written file unreadable.
 */
function sessionCacheFile(): string {
  const project = createHash("sha256").update(URL).digest("hex").slice(0, 12);
  return join(tmpdir(), `action-test-sessions-${project}.json`);
}

function readSessions(): Record<string, CachedSession> {
  try {
    return JSON.parse(readFileSync(sessionCacheFile(), "utf8"));
  } catch {
    return {};
  }
}

function saveSession(key: string, session: CachedSession | null) {
  const all = readSessions();
  if (session) all[key] = session;
  else delete all[key];
  const file = sessionCacheFile();
  const tmp = `${file}.${process.pid}`;
  try {
    writeFileSync(tmp, JSON.stringify(all), { mode: 0o600 });
    renameSync(tmp, file);
  } catch {
    // A cache we can't write only costs extra sign-ins, never a failure.
  }
}

/** Resume a cached session that still has 5+ minutes left. GET /user, not a sign-in. */
async function resumeSession(
  client: SupabaseClient,
  key: string
): Promise<string | null> {
  const cached = readSessions()[key];
  if (!cached || cached.expires_at * 1000 < Date.now() + 5 * 60_000) {
    return null;
  }
  const { data, error } = await client.auth.setSession({
    access_token: cached.access_token,
    refresh_token: cached.refresh_token,
  });
  if (error || !data.user) {
    saveSession(key, null); // e.g. the seed was re-run and the user recreated
    return null;
  }
  return data.user.id;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Waits before each retry of a rate-limited sign-in (vitest hookTimeout covers them). */
const RATE_LIMIT_RETRY_MS = [5_000, 10_000, 20_000];

async function passwordSignIn(
  client: SupabaseClient,
  key: string
): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await client.auth.signInWithPassword({
      email: seedEmail(key),
      password: key === ADMIN_KEY ? (ADMIN_PASSWORD ?? "") : PASSWORD,
    });
    if (!error && data.user && data.session) {
      saveSession(key, {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at ?? 0,
        user_id: data.user.id,
      });
      return data.user.id;
    }
    if (error?.status === 429) {
      if (attempt < RATE_LIMIT_RETRY_MS.length) {
        await sleep(RATE_LIMIT_RETRY_MS[attempt]);
        continue;
      }
      throw new Error(
        `signInAs(${key}) failed: the test project's Auth rate limit is still ` +
          `reached after ${attempt + 1} tries. Wait a few minutes and re-run, ` +
          `and don't run npm test locally while CI is running.`
      );
    }
    throw new Error(
      `signInAs(${key}) failed: ${error?.message ?? "no user"}. ` +
        `Has the seed run (npm run seed) and is SEED_PASSWORD correct?`
    );
  }
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
  const userId =
    (await resumeSession(client, key)) ?? (await passwordSignIn(client, key));
  clientCache.set(key, client);
  idCache.set(key, userId);
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
