import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { signInAs, getProfileId } from "../helpers/auth";

/**
 * Class-reviews RLS — asserted at the DB level against
 * supabase/class-reviews.sql.
 *
 * FIXTURE: reviewing requires ENROLLMENT in a PUBLISHED class, so we reuse the
 * seeded "[TEST] Scene Study Fixture" (see scripts/seed.ts / classes.test.ts)
 * and enroll the reviewer ourselves in beforeAll. That's safe next to the
 * capacity test in classes.test.ts because vitest runs files serially
 * (fileParallelism: false) and both files clear their own fixture rows.
 *
 * SAFETY / CLEANUP: acts only as seed accounts. Both class_enrollments and
 * class_reviews are deletable by their owner, so beforeAll clears residue from
 * a crashed run and afterAll removes everything this file created. Fixture
 * inserts are ASSERTED (error null) before any denial test — a silently
 * failing fixture makes denials pass for the wrong reason.
 */

const FIXTURE_TITLE = "[TEST] Scene Study Fixture";

const REVIEWER = "actor-1"; // approved; enrolled by this file
const NON_ENROLLED = "editor-1"; // approved, never enrolled here
const READER = "writer-1"; // approved, just reads

let reviewer: SupabaseClient, nonEnrolled: SupabaseClient, reader: SupabaseClient;
let reviewerId: string, nonEnrolledId: string;
let fixtureId: string;

/** The reviewer clears their own review + enrollment in the fixture. */
async function clearReviewerRows() {
  await reviewer
    .from("class_reviews")
    .delete()
    .eq("class_id", fixtureId)
    .eq("reviewer_id", reviewerId);
  await reviewer
    .from("class_enrollments")
    .delete()
    .eq("class_id", fixtureId)
    .eq("user_id", reviewerId);
}

beforeAll(async () => {
  [reviewer, nonEnrolled, reader] = await Promise.all([
    signInAs(REVIEWER),
    signInAs(NON_ENROLLED),
    signInAs(READER),
  ]);
  [reviewerId, nonEnrolledId] = await Promise.all([
    getProfileId(REVIEWER),
    getProfileId(NON_ENROLLED),
  ]);

  const { data: fixture } = await reviewer
    .from("classes")
    .select("id")
    .eq("title", FIXTURE_TITLE)
    .eq("status", "published")
    .maybeSingle();
  if (!fixture) {
    throw new Error(
      `Missing published fixture "${FIXTURE_TITLE}". Run \`npm run seed\` — it ` +
        `seeds this class for the enrollment and review tests.`
    );
  }
  fixtureId = fixture.id as string;

  // Clear residue from a crashed run, then enroll the reviewer — and ASSERT
  // the enrollment landed, since every review test below depends on it.
  await clearReviewerRows();
  const { error: enrollErr } = await reviewer
    .from("class_enrollments")
    .insert({ class_id: fixtureId, user_id: reviewerId });
  expect(enrollErr).toBeNull();
});

afterAll(async () => {
  await clearReviewerRows();
});

describe("class reviews RLS", () => {
  // (a) The happy path: an enrolled approved pro can review the class.
  test("a) an enrolled approved pro can insert a review", async () => {
    const { error } = await reviewer.from("class_reviews").insert({
      class_id: fixtureId,
      reviewer_id: reviewerId,
      rating: 5,
      body: "[TEST] sharp, actionable scene notes",
    });
    expect(error).toBeNull();
  });

  // (b) is_enrolled() gate — approved is not enough; you must have enrolled.
  test("b) a non-enrolled approved pro cannot insert a review", async () => {
    const { error } = await nonEnrolled.from("class_reviews").insert({
      class_id: fixtureId,
      reviewer_id: nonEnrolledId,
      rating: 4,
      body: "[TEST] should be rejected",
    });
    expect(error).not.toBeNull(); // is_enrolled() in the insert policy
  });

  // (c) One review per person per class — the unique constraint, not RLS,
  // rejects the second insert.
  test("c) a second review by the same enrollee is rejected", async () => {
    const { error } = await reviewer.from("class_reviews").insert({
      class_id: fixtureId,
      reviewer_id: reviewerId,
      rating: 4,
      body: "[TEST] duplicate review",
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe("23505"); // unique (class_id, reviewer_id)
  });

  // (d) Reviews on a PUBLISHED class are readable by any authenticated pro.
  test("d) reviews on a published class are readable by another pro", async () => {
    const { data, error } = await reader
      .from("class_reviews")
      .select("id, rating, reviewer_id")
      .eq("class_id", fixtureId);
    expect(error).toBeNull();
    expect((data ?? []).some((r) => r.reviewer_id === reviewerId)).toBe(true);
  });

  // (e) UPDATE is own-row only. The foreign update matches no row the policy
  // lets nonEnrolled update (the row IS visible to them — the class is
  // published — so this is the update policy doing the work): 0 rows, no error.
  test("e) a user can update their own review but not someone else's", async () => {
    const { error: ownErr } = await reviewer
      .from("class_reviews")
      .update({ rating: 3 })
      .eq("class_id", fixtureId)
      .eq("reviewer_id", reviewerId);
    expect(ownErr).toBeNull();
    const { data: afterOwn } = await reviewer
      .from("class_reviews")
      .select("rating")
      .eq("class_id", fixtureId)
      .eq("reviewer_id", reviewerId)
      .single();
    expect(afterOwn?.rating).toBe(3);

    const { data: foreignRows } = await nonEnrolled
      .from("class_reviews")
      .update({ rating: 1 })
      .eq("class_id", fixtureId)
      .eq("reviewer_id", reviewerId)
      .select("id");
    expect(foreignRows ?? []).toHaveLength(0);

    const { data: afterForeign } = await reader
      .from("class_reviews")
      .select("rating")
      .eq("class_id", fixtureId)
      .eq("reviewer_id", reviewerId)
      .single();
    expect(afterForeign?.rating).toBe(3); // untouched by the foreign update
  });
});
