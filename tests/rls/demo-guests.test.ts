import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  ADMIN_KEY,
  ADMIN_PASSWORD,
  getProfileId,
  signInAs,
} from "../helpers/auth";

/**
 * Demo guests — an anonymous sign-in becomes an approved pro named "Guest N"
 * only while demo_mode is on, and nobody can change who is a guest. Asserted at
 * the DB level against supabase/demo-guests.sql and profiles_guard_privileged
 * (supabase/status-guards.sql).
 *
 * ADMIN: flipping demo_mode needs seed-admin-1 (SEED_ADMIN_PASSWORD). Without
 * it, every test except "a non-admin can't flip demo_mode" skips visibly.
 *
 * LEFTOVERS: each run creates two anonymous auth users (one with a guest
 * profile). The tests use only the anon key, so they can't delete users;
 * supabase/one-off/2026-11-19-remove-demo-guests.sql removes them.
 *
 * SAFETY / CLEANUP: afterAll turns demo_mode OFF and puts back PENDING's
 * status, then VERIFIES both. It runs even when assertions fail.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PRO = "cinematographer-1"; // approved seed pro, not an admin
const PENDING = "director-2"; // seed PENDING pro, a real (non-anonymous) account
const HAS_ADMIN = !!ADMIN_PASSWORD;
const NO_ADMIN = "skipped: SEED_ADMIN_PASSWORD is unset";

let pro: SupabaseClient, pending: SupabaseClient;
let admin: SupabaseClient | undefined;
let pendingId: string;

/** A brand-new anonymous session, as /demo creates on a guest's phone. */
async function newGuest(): Promise<{ client: SupabaseClient; id: string }> {
  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInAnonymously();
  expect(error).toBeNull();
  expect(data.user?.is_anonymous).toBe(true);
  return { client, id: data.user!.id };
}

async function setDemoMode(on: boolean) {
  const { error } = await admin!
    .from("platform_settings")
    .update({ demo_mode: on })
    .eq("id", true);
  expect(error).toBeNull();
}

/** What a guest's insert sends if it tries to pick its own privileges. */
function greedyProfile(id: string) {
  return {
    id,
    email: "",
    account_type: "consumer",
    application_status: "pending",
    is_admin: true,
    is_demo_guest: false,
    display_name: "Not A Guest",
  };
}

const GUEST_COLUMNS =
  "account_type, application_status, is_admin, is_demo_guest, display_name, role, headline, bio, skills";

beforeAll(async () => {
  [pro, pending] = await Promise.all([signInAs(PRO), signInAs(PENDING)]);
  pendingId = await getProfileId(PENDING);
  if (HAS_ADMIN) {
    admin = await signInAs(ADMIN_KEY);
  } else {
    console.warn(`[demo-guests] Admin tests ${NO_ADMIN}.`);
  }
});

afterAll(async () => {
  if (!admin) return;
  await admin.from("platform_settings").update({ demo_mode: false }).eq("id", true);
  await admin
    .from("profiles")
    .update({ application_status: "pending", is_demo_guest: false })
    .eq("id", pendingId);

  const leftovers: string[] = [];
  const { data: s } = await admin
    .from("platform_settings")
    .select("demo_mode")
    .maybeSingle();
  if (s?.demo_mode !== false) leftovers.push("demo_mode is not off");
  const { data: p } = await admin
    .from("profiles")
    .select("application_status, is_demo_guest")
    .eq("id", pendingId)
    .single();
  if (p?.application_status !== "pending" || p?.is_demo_guest !== false)
    leftovers.push(`${PENDING} is '${p?.application_status}', guest=${p?.is_demo_guest}`);
  if (leftovers.length > 0) {
    throw new Error(
      `demo-guests teardown left data changed:\n  ${leftovers.join("\n  ")}\n` +
        `Fix by hand as an admin on /admin/settings and /admin.`
    );
  }
});

describe("demo guests", () => {
  test("1) a non-admin cannot flip demo_mode", async () => {
    const { data, error } = await pro
      .from("platform_settings")
      .update({ demo_mode: true })
      .eq("id", true)
      .select("id");
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  test.skipIf(!HAS_ADMIN)("2) an admin can flip demo_mode", async () => {
    await setDemoMode(true);
    const { data } = await admin!.from("platform_settings").select("demo_mode").single();
    expect(data!.demo_mode).toBe(true);
    await setDemoMode(false);
  });

  test.skipIf(!HAS_ADMIN)("3) demo off: an anonymous user cannot create any profile", async () => {
    await setDemoMode(false);
    const { client, id } = await newGuest();

    for (const account_type of ["professional", "consumer"]) {
      const { error } = await client
        .from("profiles")
        .insert({ id, email: "", account_type });
      expect(error?.message).toMatch(/only open during a live demo/);
    }
    const { data } = await client.from("profiles").select("id").eq("id", id).maybeSingle();
    expect(data).toBeNull();
  });

  describe.skipIf(!HAS_ADMIN)("demo on", () => {
    let guest: SupabaseClient;
    let guestId: string;
    let guestName: string;

    beforeAll(async () => {
      await setDemoMode(true);
      ({ client: guest, id: guestId } = await newGuest());
    });

    test("4) a guest is an approved professional named Guest N, with sample details", async () => {
      const { data, error } = await guest
        .from("profiles")
        .insert(greedyProfile(guestId))
        .select(GUEST_COLUMNS)
        .single();
      expect(error).toBeNull();
      expect(data).toMatchObject({
        account_type: "professional",
        application_status: "approved",
        is_admin: false,
        is_demo_guest: true,
      });
      expect(data!.display_name).toMatch(/^Guest \d+$/);
      expect(data!.role).toBeTruthy();
      expect(data!.headline).toBeTruthy();
      expect(data!.bio).toBeTruthy();
      expect(data!.skills).toContain(data!.role);
      guestName = data!.display_name as string;

      const { data: approved } = await guest.rpc("is_approved_pro");
      expect(approved).toBe(true);
    });

    test("5) a guest cannot change its own status, account type or guest flag", async () => {
      const { error } = await guest
        .from("profiles")
        .update({
          application_status: "rejected",
          account_type: "consumer",
          is_demo_guest: false,
          is_admin: true,
        })
        .eq("id", guestId);
      expect(error).toBeNull();

      const { data } = await guest.from("profiles").select(GUEST_COLUMNS).eq("id", guestId).single();
      expect(data).toMatchObject({
        account_type: "professional",
        application_status: "approved",
        is_admin: false,
        is_demo_guest: true,
      });
    });

    test("6) a real (non-anonymous) account cannot use the demo path", async () => {
      // demo_mode is on. The guard keys on the JWT's is_anonymous claim, so a
      // seed account's attempt to mark itself a guest or approve itself is
      // put back.
      const { error } = await pending
        .from("profiles")
        .update({ is_demo_guest: true, application_status: "approved" })
        .eq("id", pendingId);
      expect(error).toBeNull();
      const { data } = await pending
        .from("profiles")
        .select("application_status, is_demo_guest")
        .eq("id", pendingId)
        .single();
      expect(data).toEqual({ application_status: "pending", is_demo_guest: false });

      // And it has no anonymous session to get one with: inserting a second
      // profile for itself fails on the primary key, not the demo branch.
      const { error: insertError } = await pending
        .from("profiles")
        .insert({ id: pendingId, email: "", account_type: "professional" });
      expect(insertError).not.toBeNull();
    });

    test("7) guests are in public_profiles, flagged, but not in search", async () => {
      const { data: row } = await pro
        .from("public_profiles")
        .select("id, is_demo_guest")
        .eq("id", guestId)
        .maybeSingle();
      expect(row).toEqual({ id: guestId, is_demo_guest: true });

      // The browsing-list filter the app uses (People, Explore, suggestions).
      const { data: listed } = await pro
        .from("public_profiles")
        .select("id")
        .eq("is_demo_guest", false)
        .eq("id", guestId);
      expect(listed).toEqual([]);

      const { data: hits, error } = await pro.rpc("global_search", { q: guestName });
      expect(error).toBeNull();
      expect((hits ?? []).some((h: { id: string }) => h.id === guestId)).toBe(false);
    });

    test("8) a new guest follows the members, not admins or guests, so its Feed has posts", async () => {
      const [proId, adminId] = await Promise.all([
        getProfileId(PRO),
        getProfileId(ADMIN_KEY),
      ]);

      const { data: follows, error } = await guest
        .from("follows")
        .select("following_id")
        .eq("follower_id", guestId);
      expect(error).toBeNull();
      const following = (follows ?? []).map((f) => f.following_id as string);
      expect(following).toContain(proId);
      expect(following).not.toContain(adminId);
      expect(following).not.toContain(guestId);

      // None of them is another guest.
      const { data: guestsFollowed } = await pro
        .from("public_profiles")
        .select("id")
        .in("id", following)
        .eq("is_demo_guest", true);
      expect(guestsFollowed).toEqual([]);

      // The Feed's own rule (self + followed) now lets the guest see a
      // member's posts: the seed gives every approved seed pro status updates.
      const { data: feed } = await guest
        .from("activity_events")
        .select("id")
        .eq("actor_id", proId)
        .limit(1);
      expect(feed ?? []).toHaveLength(1);
    });
  });
});
