import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { signInAs, getProfileId } from "../helpers/auth";

/**
 * Connections / reactions / endorsements RLS — asserted at the DB level
 * against supabase/connections.sql.
 *
 * FIXTURE: everything is built here from seed accounts (connections start
 * empty — nothing is seeded). The reaction tests hang off a SEEDED director-1
 * status update, exactly like comments.test.ts: per the seeded FOLLOWS web,
 * actor-1 follows director-1 and so can_view_event() passes. The endorsement
 * tests lean on seeded actor-2: role 'actor' (primary discipline) with
 * profiles.skills ['writer'] (secondary). director-2 is a seeded PENDING pro,
 * so is_approved_pro() is false for them.
 *
 * SAFETY / CLEANUP: acts only as seed accounts, anon key only. Connections,
 * reactions and endorsements are all deletable by a party/owner, so beforeAll
 * clears residue from a crashed run and afterAll removes everything this file
 * created. Fixture inserts are ASSERTED (error null) before any denial test.
 */

const A = "actor-1"; // approved pro; follows director-1 (sees the event)
const B = "director-1"; // approved pro; authors the seeded status update
const C = "producer-1"; // approved pro; the mutual party
const NON_APPROVED = "director-2"; // seed PENDING pro → is_approved_pro() false
const SUBJECT = "actor-2"; // approved; role 'actor', skills ['writer']

let a: SupabaseClient, b: SupabaseClient, c: SupabaseClient;
let nonApproved: SupabaseClient;
let aId: string, bId: string, cId: string, nonApprovedId: string;
let subjectId: string;
let eventId: string;

/** Each party deletes every connection between test accounts it is part of. */
async function clearTestConnections() {
  const ids = [aId, bId, cId, nonApprovedId];
  await Promise.all(
    [a, b, c].map((client) =>
      client
        .from("connections")
        .delete()
        .in("requester_id", ids)
        .in("addressee_id", ids)
    )
  );
}

async function clearTestReactionsAndEndorsements() {
  await Promise.all([
    a.from("activity_reactions").delete().eq("event_id", eventId).eq("actor_id", aId),
    a.from("endorsements").delete().eq("endorser_id", aId).eq("subject_id", subjectId),
  ]);
}

beforeAll(async () => {
  [a, b, c, nonApproved] = await Promise.all([
    signInAs(A),
    signInAs(B),
    signInAs(C),
    signInAs(NON_APPROVED),
  ]);
  [aId, bId, cId, nonApprovedId, subjectId] = await Promise.all([
    getProfileId(A),
    getProfileId(B),
    getProfileId(C),
    getProfileId(NON_APPROVED),
    getProfileId(SUBJECT),
  ]);

  // Any seeded director-1 status update works as the reaction fixture; the
  // author can always see their own.
  const { data: event } = await b
    .from("activity_events")
    .select("id")
    .eq("actor_id", bId)
    .eq("kind", "status_update")
    .limit(1)
    .maybeSingle();
  if (!event) {
    throw new Error(
      `Missing seeded ${B} status update. Run \`npm run seed\` — it seeds ` +
        `the feed events these reaction tests hang off.`
    );
  }
  eventId = event.id as string;

  await clearTestConnections();
  await clearTestReactionsAndEndorsements();
});

afterAll(async () => {
  await clearTestConnections();
  await clearTestReactionsAndEndorsements();
});

describe("connections RLS", () => {
  // (a) INSERT gate, caller side: an approved pro can request; a pending pro
  // cannot. A→B stays PENDING for the rest of the suite.
  test("a) an approved pro can request; a non-approved pro cannot", async () => {
    const { error: okErr } = await a
      .from("connections")
      .insert({ requester_id: aId, addressee_id: bId });
    expect(okErr).toBeNull();

    const { error } = await nonApproved
      .from("connections")
      .insert({ requester_id: nonApprovedId, addressee_id: bId });
    expect(error).not.toBeNull();
  });

  // (b) INSERT gate, other side: profile_is_approved_pro(addressee_id) rejects
  // a request TO a pending pro.
  test("b) a request to a non-approved pro is rejected", async () => {
    const { error } = await a
      .from("connections")
      .insert({ requester_id: aId, addressee_id: nonApprovedId });
    expect(error).not.toBeNull();
  });

  // (c) The UPDATE policy's USING clause: B is not the addressee of A→C, so
  // the row isn't updatable by B — 0 rows, no error, and it stays pending.
  test("c) B cannot accept a request B did not receive", async () => {
    const { error: fixtureErr } = await a
      .from("connections")
      .insert({ requester_id: aId, addressee_id: cId });
    expect(fixtureErr).toBeNull();

    const { data, error } = await b
      .from("connections")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("requester_id", aId)
      .eq("addressee_id", cId)
      .select("status");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: row } = await a
      .from("connections")
      .select("status")
      .eq("requester_id", aId)
      .eq("addressee_id", cId)
      .single();
    expect(row?.status).toBe("pending");
  });

  // (d) Same USING clause, requester side: A is not the addressee of their own
  // outgoing request, so A cannot accept it.
  test("d) A cannot accept their own outgoing request", async () => {
    const { data, error } = await a
      .from("connections")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("requester_id", aId)
      .eq("addressee_id", bId)
      .select("status");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  // (e) The freeze trigger: RLS WITH CHECK can't see the old row, so without
  // the trigger B could rewrite requester_id while accepting and fabricate a
  // connection to a third party. The trigger's exception proves it fires.
  test("e) B cannot rewrite requester_id while accepting", async () => {
    const { error } = await b
      .from("connections")
      .update({
        requester_id: cId,
        status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("requester_id", aId)
      .eq("addressee_id", bId);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/immutable/);
  });

  // (f) The happy path: the addressee accepts. Builds the accepted A–C and
  // B–C edges the mutual-count tests below depend on.
  test("f) the addressee can accept a pending request", async () => {
    const { data: acceptedAC, error: acErr } = await c
      .from("connections")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("requester_id", aId)
      .eq("addressee_id", cId)
      .select("status");
    expect(acErr).toBeNull();
    expect(acceptedAC ?? []).toHaveLength(1);

    const { error: bcInsertErr } = await b
      .from("connections")
      .insert({ requester_id: bId, addressee_id: cId });
    expect(bcInsertErr).toBeNull();

    const { data: acceptedBC, error: bcErr } = await c
      .from("connections")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("requester_id", bId)
      .eq("addressee_id", cId)
      .select("status");
    expect(bcErr).toBeNull();
    expect(acceptedBC ?? []).toHaveLength(1);
  });

  // (g) The pair unique index (not the policy) blocks the reciprocal
  // duplicate: A→B exists, so B→A must fail with a unique violation (23505),
  // not a policy denial.
  test("g) the reciprocal duplicate B→A is blocked by the pair index", async () => {
    const { error } = await b
      .from("connections")
      .insert({ requester_id: bId, addressee_id: aId });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("23505");
  });

  // (h) Two-parties-only SELECT: C is not part of A→B and reads 0 rows, while
  // a party (A) sees it.
  test("h) a third party cannot read a connection between A and B", async () => {
    const { data: asThird, error: thirdErr } = await c
      .from("connections")
      .select("status")
      .eq("requester_id", aId)
      .eq("addressee_id", bId);
    expect(thirdErr).toBeNull();
    expect(asThird ?? []).toHaveLength(0);

    const { data: asParty } = await a
      .from("connections")
      .select("status")
      .eq("requester_id", aId)
      .eq("addressee_id", bId);
    expect(asParty ?? []).toHaveLength(1);
  });

  // (i) mutual_connection_count: symmetric, and correct even though the other
  // leg is INVISIBLE to the caller — A cannot SELECT the B–C row, so an inline
  // count under A's RLS would say 0. The helper must say 1. This is the
  // undercount trap.
  test("i) mutual_connection_count is symmetric and immune to RLS undercount", async () => {
    // A is connected to C and B is connected to C (accepted in f); A and B are
    // only PENDING with each other, so C is their one mutual.
    const { data: bcRowForA, error: bcSelectErr } = await a
      .from("connections")
      .select("status")
      .eq("requester_id", bId)
      .eq("addressee_id", cId);
    expect(bcSelectErr).toBeNull();
    expect(bcRowForA ?? []).toHaveLength(0); // the B–C leg is hidden from A

    const { data: fromA, error: aErr } = await a.rpc("mutual_connection_count", {
      target: bId,
    });
    expect(aErr).toBeNull();
    expect(fromA).toBe(1);

    const { data: fromB, error: bErr } = await b.rpc("mutual_connection_count", {
      target: aId,
    });
    expect(bErr).toBeNull();
    expect(fromB).toBe(1);
  });
});

describe("activity_reactions RLS", () => {
  // (j) Congratulate is a toggle backed by the composite PK: insert once,
  // a second insert is a unique violation, delete turns it off.
  test("j) congratulate is idempotent: re-insert fails, delete removes it", async () => {
    const { error: insertErr } = await a
      .from("activity_reactions")
      .insert({ event_id: eventId, actor_id: aId, kind: "congratulate" });
    expect(insertErr).toBeNull();

    const { error: dupErr } = await a
      .from("activity_reactions")
      .insert({ event_id: eventId, actor_id: aId, kind: "congratulate" });
    expect(dupErr).not.toBeNull();
    expect(dupErr?.code).toBe("23505");

    const { data: deleted, error: deleteErr } = await a
      .from("activity_reactions")
      .delete()
      .eq("event_id", eventId)
      .eq("actor_id", aId)
      .eq("kind", "congratulate")
      .select("kind");
    expect(deleteErr).toBeNull();
    expect(deleted ?? []).toHaveLength(1);

    const { data: reacted, error: rpcErr } = await a.rpc("has_reacted", {
      p_event_id: eventId,
      p_kind: "congratulate",
    });
    expect(rpcErr).toBeNull();
    expect(reacted).toBe(false);
  });
});

describe("endorsements RLS", () => {
  // (k) profile_lists_skill(), skills arm: 'writer' is in actor-2's
  // profiles.skills.
  test("k) endorsing actor-2 for 'writer' succeeds (secondary skill)", async () => {
    const { error } = await a
      .from("endorsements")
      .insert({ endorser_id: aId, subject_id: subjectId, skill: "writer" });
    expect(error).toBeNull();
  });

  // (l) profile_lists_skill(), role arm: 'actor' is actor-2's primary
  // discipline (profiles.role), NOT in their skills array — the arm that makes
  // the common "endorse an actor for acting" case work.
  test("l) endorsing actor-2 for 'actor' succeeds (primary discipline)", async () => {
    const { error } = await a
      .from("endorsements")
      .insert({ endorser_id: aId, subject_id: subjectId, skill: "actor" });
    expect(error).toBeNull();
  });

  // (m) A skill the subject lists nowhere is rejected.
  test("m) endorsing actor-2 for 'composer' is rejected", async () => {
    const { error } = await a
      .from("endorsements")
      .insert({ endorser_id: aId, subject_id: subjectId, skill: "composer" });
    expect(error).not.toBeNull();
  });
});
