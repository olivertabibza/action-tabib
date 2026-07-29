import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { signInAs, getProfileId } from "../helpers/auth";

/**
 * Feed-comments RLS — asserted at the DB level against supabase/comments.sql.
 *
 * FIXTURE: comments follow event visibility (can_view_event), so we hang all
 * rows off a SEEDED director-1 status update (see scripts/seed.ts). The event
 * itself is never created here — activity_events is an append-only log with no
 * DELETE policy, so a test-created event could never be cleaned up. Per the
 * seeded FOLLOWS web, actor-1 follows director-1 (can see the event) and
 * composer-1 does not (cannot).
 *
 * SAFETY / CLEANUP: acts only as seed accounts. Comments are deletable by
 * their author, so beforeAll clears [TEST] residue from a crashed run and
 * afterAll removes everything this file created (replies also fall to the
 * parent_id cascade). Fixture inserts are ASSERTED (error null) before any
 * denial test — a silently failing fixture makes denials pass for the wrong
 * reason.
 */

const EVENT_AUTHOR = "director-1"; // seeded status update used as the fixture event
const FOLLOWER = "actor-1"; // follows director-1 in the seeded FOLLOWS web
const NON_FOLLOWER = "composer-1"; // does NOT follow director-1

let author: SupabaseClient, follower: SupabaseClient, nonFollower: SupabaseClient;
let authorId: string, followerId: string, nonFollowerId: string;
let eventId: string;
let topLevelId: string; // follower's top-level comment (a)
let replyId: string; // author's reply to it (c)

/** Each account deletes its own [TEST] comments on the fixture event. */
async function clearTestComments() {
  await Promise.all(
    [author, follower].map((client) =>
      client
        .from("activity_comments")
        .delete()
        .eq("event_id", eventId)
        .like("body", "[TEST]%")
    )
  );
}

beforeAll(async () => {
  [author, follower, nonFollower] = await Promise.all([
    signInAs(EVENT_AUTHOR),
    signInAs(FOLLOWER),
    signInAs(NON_FOLLOWER),
  ]);
  [authorId, followerId, nonFollowerId] = await Promise.all([
    getProfileId(EVENT_AUTHOR),
    getProfileId(FOLLOWER),
    getProfileId(NON_FOLLOWER),
  ]);

  // Any seeded director-1 status update works as the fixture event; the author
  // can always see their own.
  const { data: event } = await author
    .from("activity_events")
    .select("id")
    .eq("actor_id", authorId)
    .eq("kind", "status_update")
    .limit(1)
    .maybeSingle();
  if (!event) {
    throw new Error(
      `Missing seeded ${EVENT_AUTHOR} status update. Run \`npm run seed\` — it ` +
        `seeds the feed events these comment tests hang off.`
    );
  }
  eventId = event.id as string;

  await clearTestComments();
});

afterAll(async () => {
  await clearTestComments();
});

describe("feed comments RLS", () => {
  // (a) The happy path: a follower of the event's author can read the thread
  // and add to it.
  test("a) a follower can insert and read a comment on the event", async () => {
    const { data: inserted, error: insertErr } = await follower
      .from("activity_comments")
      .insert({
        event_id: eventId,
        author_id: followerId,
        body: "[TEST] congrats on locking picture",
      })
      .select("id")
      .single();
    expect(insertErr).toBeNull();
    topLevelId = inserted!.id as string;

    const { data, error } = await follower
      .from("activity_comments")
      .select("id, author_id")
      .eq("event_id", eventId);
    expect(error).toBeNull();
    expect((data ?? []).some((c) => c.id === topLevelId)).toBe(true);
  });

  // (b) can_view_event() gate — a non-follower can't see the event, so its
  // comments are invisible (0 rows, no error) and commenting is rejected.
  test("b) a non-follower gets zero rows and cannot insert", async () => {
    const { data, error: selectErr } = await nonFollower
      .from("activity_comments")
      .select("id")
      .eq("event_id", eventId);
    expect(selectErr).toBeNull();
    expect(data ?? []).toHaveLength(0); // (a) proved a comment exists

    const { error: insertErr } = await nonFollower
      .from("activity_comments")
      .insert({
        event_id: eventId,
        author_id: nonFollowerId,
        body: "[TEST] should be rejected",
      });
    expect(insertErr).not.toBeNull();
  });

  // (c) comment_is_top_level() gate — a reply to a top-level comment is fine,
  // but a reply to a REPLY is rejected: one level of nesting, enforced in the
  // database.
  test("c) a reply to a reply is rejected", async () => {
    const { data: reply, error: replyErr } = await author
      .from("activity_comments")
      .insert({
        event_id: eventId,
        author_id: authorId,
        parent_id: topLevelId,
        body: "[TEST] thanks — sound mix starts monday",
      })
      .select("id")
      .single();
    expect(replyErr).toBeNull();
    replyId = reply!.id as string;

    const { error } = await follower.from("activity_comments").insert({
      event_id: eventId,
      author_id: followerId,
      parent_id: replyId,
      body: "[TEST] nested reply, should be rejected",
    });
    expect(error).not.toBeNull();
  });

  // (d) Delete is own-row only, and removing a top-level comment takes its
  // replies with it via the parent_id FK cascade — even replies by OTHER
  // authors, which no RLS delete policy would let the deleter touch directly.
  test("d) deleting your own top-level comment cascades its replies", async () => {
    const { data: deleted, error } = await follower
      .from("activity_comments")
      .delete()
      .eq("id", topLevelId)
      .select("id");
    expect(error).toBeNull();
    expect(deleted ?? []).toHaveLength(1);

    // The author could see their own reply; after the cascade it's gone.
    const { data: replies, error: replySelectErr } = await author
      .from("activity_comments")
      .select("id")
      .eq("id", replyId);
    expect(replySelectErr).toBeNull();
    expect(replies ?? []).toHaveLength(0);
  });
});
