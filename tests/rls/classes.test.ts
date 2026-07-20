import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { signInAs, getProfileId } from "../helpers/auth";

/**
 * Classes RLS — the rules that are slow and annoying to click through by hand.
 * Asserted at the DB level against supabase/classes.sql.
 *
 * FIXTURE: enrollment requires a PUBLISHED class, and only an admin can publish
 * (no admin/service-role in tests). So scripts/seed.ts seeds one published
 * "[TEST] Scene Study Fixture" (capacity 2) that these tests enroll into.
 *
 * SAFETY / CLEANUP: acts only as seed accounts. class_enrollments ARE deletable
 * by their owner, so afterAll removes every enrollment we created. `classes`
 * rows are append-only (no DELETE policy): the published fixture is seed-owned,
 * and the one pending "[TEST]" class used below is get-or-created (reused across
 * runs), so both are bounded, [TEST]-tagged residue — never real data.
 */

const FIXTURE_TITLE = "[TEST] Scene Study Fixture";
const FIXTURE_CAPACITY = 2;
const HIDDEN_TITLE = "[TEST] Hidden Pending Class";

const OWNER = "director-1"; // owns the published fixture (approved)
const E1 = "actor-1"; // approved enrollees (non-owner)
const E2 = "actor-2";
const E3 = "writer-1"; // the over-capacity enrollee
const PENDING_AUTHOR = "producer-1"; // owns the pending [TEST] class
const OTHER_PRO = "editor-1"; // approved, but not the pending author
const NON_APPROVED = "director-2"; // seed PENDING pro → is_approved_pro() is false

let e1: SupabaseClient, e2: SupabaseClient, e3: SupabaseClient;
let author: SupabaseClient, other: SupabaseClient, nonApproved: SupabaseClient;
let e1Id: string, e2Id: string, e3Id: string, pendingAuthorId: string;

let fixtureId: string;
let hiddenClassId: string;

/** Each enrollee clears its own enrollment in the fixture (room + idempotency). */
async function clearFixtureEnrollments() {
  await Promise.all([
    e1.from("class_enrollments").delete().eq("class_id", fixtureId).eq("user_id", e1Id),
    e2.from("class_enrollments").delete().eq("class_id", fixtureId).eq("user_id", e2Id),
    e3.from("class_enrollments").delete().eq("class_id", fixtureId).eq("user_id", e3Id),
  ]);
}

beforeAll(async () => {
  [e1, e2, e3, author, other, nonApproved] = await Promise.all([
    signInAs(E1),
    signInAs(E2),
    signInAs(E3),
    signInAs(PENDING_AUTHOR),
    signInAs(OTHER_PRO),
    signInAs(NON_APPROVED),
  ]);
  [e1Id, e2Id, e3Id, pendingAuthorId] = await Promise.all([
    getProfileId(E1),
    getProfileId(E2),
    getProfileId(E3),
    getProfileId(PENDING_AUTHOR),
  ]);

  // The published fixture (visible to any approved pro because it's published).
  const { data: fixture } = await e1
    .from("classes")
    .select("id, capacity, status")
    .eq("title", FIXTURE_TITLE)
    .eq("status", "published")
    .maybeSingle();
  if (!fixture) {
    throw new Error(
      `Missing published fixture "${FIXTURE_TITLE}". Run \`npm run seed\` — it ` +
        `seeds this class for the enrollment tests.`
    );
  }
  fixtureId = fixture.id as string;
  expect(fixture.capacity).toBe(FIXTURE_CAPACITY);

  // Get-or-create the pending [TEST] class (append-only, so reuse across runs).
  const { data: existingHidden } = await author
    .from("classes")
    .select("id")
    .eq("created_by", pendingAuthorId)
    .eq("title", HIDDEN_TITLE)
    .eq("status", "pending")
    .maybeSingle();
  if (existingHidden) {
    hiddenClassId = existingHidden.id as string;
  } else {
    const { data, error } = await author
      .from("classes")
      .insert({
        created_by: pendingAuthorId,
        title: HIDDEN_TITLE,
        description: "[TEST] not for enrollment",
        discipline: "actor",
        format: "in_person",
        level: "all",
        venue: "[TEST]",
        price_cents: 0,
        capacity: 5,
        starts_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        // status intentionally omitted — the column default keeps it 'pending'.
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    hiddenClassId = data!.id as string;
  }
});

afterAll(async () => {
  await clearFixtureEnrollments();
});

describe("classes RLS", () => {
  // (b) is_approved_pro gate — a non-approved account (seed PENDING pro) cannot
  // enroll even in a published class. Run with the fixture EMPTY so the only
  // possible reason for rejection is the approval gate, not capacity.
  test("b) a non-approved account cannot enroll", async () => {
    await clearFixtureEnrollments();
    const { error } = await nonApproved.from("class_enrollments").insert({
      class_id: fixtureId,
      user_id: await getProfileId(NON_APPROVED),
    });
    expect(error).not.toBeNull(); // is_approved_pro() in the insert policy
  });

  // (a) Capacity is enforced BY THE POLICY, not app code: fill to capacity (2),
  // then the next enroll INSERT is rejected.
  test("a) capacity is enforced by RLS", async () => {
    await clearFixtureEnrollments();

    const { error: err1 } = await e1
      .from("class_enrollments")
      .insert({ class_id: fixtureId, user_id: e1Id });
    expect(err1).toBeNull();
    const { error: err2 } = await e2
      .from("class_enrollments")
      .insert({ class_id: fixtureId, user_id: e2Id });
    expect(err2).toBeNull();

    // Class is now full (capacity 2). The third enroll must be rejected by the
    // capacity subquery in the insert policy — NOT by any app-level check.
    const { error: err3 } = await e3
      .from("class_enrollments")
      .insert({ class_id: fixtureId, user_id: e3Id });
    expect(err3).not.toBeNull();
  });

  // (c) An unpublished ('pending') class is invisible to a non-author.
  test("c) a pending class is invisible to a non-author", async () => {
    // The author can see their own draft…
    const { data: seenByAuthor } = await author
      .from("classes")
      .select("id")
      .eq("id", hiddenClassId);
    expect(seenByAuthor?.length ?? 0).toBe(1);

    // …but another approved pro cannot (RLS: published OR own OR admin).
    const { data: seenByOther } = await other
      .from("classes")
      .select("id")
      .eq("id", hiddenClassId);
    expect(seenByOther?.length ?? 0).toBe(0);
  });

  // (d) A non-admin cannot flip status to 'published'. We use a NON-AUTHOR here:
  // note that by design (mirroring content.sql) an AUTHOR can update their own
  // row's columns, so the real protection is that OTHER pros can't publish your
  // class. The update simply matches no updatable row → status stays 'pending'.
  test("d) a non-admin (non-author) cannot publish a class", async () => {
    await other
      .from("classes")
      .update({ status: "published" })
      .eq("id", hiddenClassId);

    const { data: after } = await author
      .from("classes")
      .select("status")
      .eq("id", hiddenClassId)
      .single();
    expect(after?.status).toBe("pending");
  });
});
