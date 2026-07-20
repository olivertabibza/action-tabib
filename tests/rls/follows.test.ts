import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { signInAs, getProfileId } from "../helpers/auth";

/**
 * Follows + feed visibility RLS — the graph the Pro Feed depends on. Asserted at
 * the DB level against supabase/social-feed.sql (the is_following() /
 * is_approved_pro() helpers and the activity_events SELECT/INSERT policies).
 *
 * Pair choices from the seed graph: the AUTHOR is actor-2, who has ZERO seed
 * followers, so we fully control who can see their events. The FOLLOWER
 * (composer-1) and NON-FOLLOWER (writer-1) neither follow actor-2 in the seed.
 *
 * SAFETY / CLEANUP: acts only as seed accounts. `follows` IS deletable by its
 * owner, so afterAll removes the follow edge we create. `activity_events` is an
 * append-only log (no DELETE policy), so the one "[TEST]" probe event is
 * get-or-created (reused across runs) — bounded, tagged, seed-only residue.
 */

const AUTHOR = "actor-2"; // zero seed followers → we control visibility
const FOLLOWER = "composer-1"; // does not follow actor-2 in the seed
const NON_FOLLOWER = "writer-1"; // does not follow actor-2 in the seed

let authorClient: SupabaseClient;
let follower: SupabaseClient;
let nonFollower: SupabaseClient;
let authorId: string, followerId: string;

let eventId: string;

beforeAll(async () => {
  [authorClient, follower, nonFollower] = await Promise.all([
    signInAs(AUTHOR),
    signInAs(FOLLOWER),
    signInAs(NON_FOLLOWER),
  ]);
  [authorId, followerId] = await Promise.all([
    getProfileId(AUTHOR),
    getProfileId(FOLLOWER),
  ]);

  // Get-or-create the author's [TEST] feed event (append-only → reuse).
  const { data: existing } = await authorClient
    .from("activity_events")
    .select("id")
    .eq("actor_id", authorId)
    .eq("kind", "status_update")
    .like("body", "[TEST]%")
    .limit(1)
    .maybeSingle();
  if (existing) {
    eventId = existing.id as string;
  } else {
    const { data, error } = await authorClient
      .from("activity_events")
      .insert({
        actor_id: authorId,
        kind: "status_update",
        body: "[TEST] follows-visibility probe",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    eventId = data!.id as string;
  }
});

afterAll(async () => {
  // Remove only the edge we created (the follower unfollows). The probe event is
  // bounded, reusable residue.
  await follower
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", authorId);
});

describe("follows RLS", () => {
  // (a) Following makes the followee's activity visible to the follower.
  test("a) a follow makes the followee's activity visible", async () => {
    const { error } = await follower
      .from("follows")
      .insert({ follower_id: followerId, following_id: authorId });
    // Idempotent: a leftover edge from a crashed run collides — treat as fine.
    if (error && error.code !== "23505") expect(error).toBeNull();

    const { data: seen } = await follower
      .from("activity_events")
      .select("id")
      .eq("id", eventId);
    expect(seen?.length ?? 0).toBe(1); // visible via is_following()
  });

  // (b) A non-follower cannot read those activity events.
  test("b) a non-follower cannot read the activity", async () => {
    const { data: seen } = await nonFollower
      .from("activity_events")
      .select("id")
      .eq("id", eventId);
    expect(seen?.length ?? 0).toBe(0);
  });

  // (c) Nobody can insert an activity event as someone else (actor_id spoofing).
  test("c) actor_id spoofing is rejected", async () => {
    const { error } = await follower.from("activity_events").insert({
      actor_id: authorId, // NOT the caller — the insert policy requires ==auth.uid()
      kind: "status_update",
      body: "[TEST] spoofed event that must be rejected",
    });
    expect(error).not.toBeNull();
  });
});
