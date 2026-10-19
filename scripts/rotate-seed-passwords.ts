/**
 * Rotate the seed accounts' shared password and revoke their sessions.
 *
 * SERVER-ONLY. Run with `npm run seed:rotate-passwords` (which loads .env.local
 * via tsx's --env-file). It uses the Supabase SECRET (service-role) key, which
 * bypasses RLS and can change any user's password — so this file must NEVER be
 * imported from anything under app/ or any client code.
 *
 * For every auth user whose email ends in @actionseed.test (except
 * seed-admin-1, which has its own SEED_ADMIN_PASSWORD), it sets the password to
 * SEED_PASSWORD, then signs in as that account with the anon key and signs out
 * globally, revoking every existing session. It never inserts, updates or
 * deletes table data.
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────────────────

const SEED_DOMAIN = "actionseed.test";
const ADMIN_EMAIL = `seed-admin-1@${SEED_DOMAIN}`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SECRET_KEY) {
  console.error(
    [
      "Missing required env vars.",
      "",
      "  NEXT_PUBLIC_SUPABASE_URL       " + (SUPABASE_URL ? "ok" : "MISSING"),
      "  NEXT_PUBLIC_SUPABASE_ANON_KEY  " + (ANON_KEY ? "ok" : "MISSING"),
      "  SUPABASE_SECRET_KEY            " + (SECRET_KEY ? "ok" : "MISSING"),
      "",
      "Add them to .env.local (see .env.local.example).",
    ].join("\n")
  );
  process.exit(1);
}

const SEED_PASSWORD = process.env.SEED_PASSWORD?.trim() ?? "";
const MIN_SEED_PASSWORD_LENGTH = 20;

if (SEED_PASSWORD.length < MIN_SEED_PASSWORD_LENGTH) {
  console.error(
    [
      SEED_PASSWORD
        ? `SEED_PASSWORD is too short (needs at least ${MIN_SEED_PASSWORD_LENGTH} characters).`
        : "Missing required env var SEED_PASSWORD.",
      "",
      "Set it in .env.local to a long random value, e.g. from:",
      "  openssl rand -hex 20",
      "",
      "The seed script, npm run seed:rotate-passwords and the tests all read it.",
    ].join("\n")
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────--

/** Seed auth users (email + id), paging through all auth users. */
async function fetchSeedAuthUsers(): Promise<{ email: string; id: string }[]> {
  const found: { email: string; id: string }[] = [];
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email?.endsWith(`@${SEED_DOMAIN}`)) {
        found.push({ email: user.email, id: user.id });
      }
    }
    if (data.users.length < perPage) break;
  }
  return found;
}

/** Sign in with the new password on a fresh anon client, then revoke every session. */
async function revokeSessions(email: string): Promise<void> {
  const client = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: SEED_PASSWORD,
  });
  if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);
  const { error: signOutErr } = await client.auth.signOut({ scope: "global" });
  if (signOutErr) throw new Error(`global sign-out failed: ${signOutErr.message}`);
}

// ── Main ──────────────────────────────────────────────────────────────────--

async function main() {
  const users = (await fetchSeedAuthUsers())
    .filter((u) => u.email !== ADMIN_EMAIL)
    .sort((a, b) => a.email.localeCompare(b.email));

  console.log(`Rotating ${users.length} seed accounts (skipping ${ADMIN_EMAIL}).\n`);

  for (const { email, id } of users) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      password: SEED_PASSWORD,
    });
    if (error) throw new Error(`${email}: password update failed: ${error.message}`);
    try {
      await revokeSessions(email);
    } catch (err) {
      throw new Error(`${email}: ${(err as Error).message}`);
    }
    console.log(`  ${email}: password updated, sessions revoked`);
  }

  console.log(`\nDone. ✅ ${users.length} accounts rotated.\n`);
}

main().catch((err) => {
  console.error("\nRotation failed:", err?.message ?? err);
  process.exit(1);
});
