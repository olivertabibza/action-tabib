import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { signInAs, getProfileId } from "../helpers/auth";

/**
 * Messages RLS — asserted at the DB level (no browser). Every thread is created
 * the way the app creates it: through public.open_conversation(), the one
 * security-definer function allowed to write conversations and participant rows
 * (supabase/messages.sql). The tests never insert either table directly, except
 * in (f)/(g), which check that a direct insert is denied.
 *
 * SAFETY / CLEANUP:
 *   - Acts only as seed accounts; every message body is "[TEST]"-prefixed.
 *   - Each test that needs a fresh thread first calls reset_seed_conversation(),
 *     a test-only definer function that deletes the thread between two
 *     @actionseed.test accounts (participants and messages cascade). afterAll
 *     resets every pair used here, so no residue is left behind.
 *
 * Pair choices depend on the seed follow graph:
 *   - COLD/IGNORE/CROSS-READ need a recipient who does NOT follow the sender.
 *     actor-1 and actor-2 don't follow composer-1 → cold DMs.
 *   - FREE PASS needs a recipient who DOES follow the sender. actor-1 follows
 *     director-1 in the seed → free pass.
 *   - director-2 is a PENDING pro in the seed → can't be messaged.
 */

// Sender for the cold-DM family, and the two recipients / outsider.
const SENDER = "composer-1";
const RECIP = "actor-1"; // does not follow composer-1 → cold
const RECIP2 = "actor-2"; // does not follow composer-1 → cold (used for Ignore)
const OUTSIDER = "writer-1"; // never a participant → can't cross-read
// Free-pass pair: recipient FOLLOWS sender.
const FP_SENDER = "director-1";
const FP_RECIP = "actor-1"; // follows director-1 in the seed
const PENDING_PRO = "director-2"; // application_status = 'pending'

let A: SupabaseClient; // SENDER
let B: SupabaseClient; // RECIP
let B2: SupabaseClient; // RECIP2
let C: SupabaseClient; // OUTSIDER
let FpA: SupabaseClient; // FP_SENDER
let aId: string, bId: string, b2Id: string, cId: string;
let fpBId: string, pendingId: string;

// Conversations created during the run (shared across ordered tests below).
let coldConvId: string;
let ignoreConvId: string;

/** Canonical (user_a < user_b) ordering — the whole model depends on it. */
function canonical(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

/** Delete any existing thread between the caller and otherId (seed-only). */
async function resetPair(client: SupabaseClient, otherId: string) {
  const { error } = await client.rpc("reset_seed_conversation", {
    p_other: otherId,
  });
  expect(error).toBeNull();
}

/** Open (or start) the thread as the caller, the way the app does. */
async function openConversation(
  client: SupabaseClient,
  otherId: string
): Promise<string> {
  const { data, error } = await client.rpc("open_conversation", {
    p_other: otherId,
  });
  expect(error).toBeNull();
  return data as string;
}

/** Reset the pair, then open a brand-new thread from `sender`. */
async function freshConversation(
  sender: SupabaseClient,
  otherId: string
): Promise<string> {
  await resetPair(sender, otherId);
  return openConversation(sender, otherId);
}

/** The participant row for userId in convId, as seen by `client` (or null). */
async function participantRow(
  client: SupabaseClient,
  convId: string,
  userId: string
) {
  const { data } = await client
    .from("conversation_participants")
    .select("conversation_id, user_id, accepted, last_read_at")
    .eq("conversation_id", convId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

beforeAll(async () => {
  [A, B, B2, C, FpA] = await Promise.all([
    signInAs(SENDER),
    signInAs(RECIP),
    signInAs(RECIP2),
    signInAs(OUTSIDER),
    signInAs(FP_SENDER),
  ]);
  [aId, bId, b2Id, cId, fpBId, pendingId] = await Promise.all([
    getProfileId(SENDER),
    getProfileId(RECIP),
    getProfileId(RECIP2),
    getProfileId(OUTSIDER),
    getProfileId(FP_RECIP),
    getProfileId(PENDING_PRO),
  ]);
});

afterAll(async () => {
  // Every pair this file touches, reset from one side. Also covers the pairs
  // (f)/(g)/(k) check were NOT created, in case a regression created them.
  await Promise.all([
    A.rpc("reset_seed_conversation", { p_other: bId }),
    A.rpc("reset_seed_conversation", { p_other: b2Id }),
    A.rpc("reset_seed_conversation", { p_other: cId }),
    A.rpc("reset_seed_conversation", { p_other: pendingId }),
    FpA.rpc("reset_seed_conversation", { p_other: fpBId }),
  ]);
});

describe("messages RLS", () => {
  // (a) COLD DM: a recipient who doesn't follow the sender lands in Requests,
  // expressed as data: their participant row is accepted = false.
  test("a) cold DM → recipient participant accepted = false (Requests)", async () => {
    coldConvId = await freshConversation(A, bId);

    const bRow = await participantRow(B, coldConvId, bId);
    expect(bRow?.accepted).toBe(false);
    const aRow = await participantRow(A, coldConvId, aId);
    expect(aRow?.accepted).toBe(true);
  });

  // (b) ACCEPT: the recipient flips their OWN row to accepted, then can send.
  test("b) recipient accepts → row flips true, and B can send", async () => {
    const { error: upErr } = await B.from("conversation_participants")
      .update({ accepted: true })
      .eq("conversation_id", coldConvId)
      .eq("user_id", bId);
    expect(upErr).toBeNull();

    const bRow = await participantRow(B, coldConvId, bId);
    expect(bRow?.accepted).toBe(true);

    const { error } = await B.from("messages").insert({
      conversation_id: coldConvId,
      sender_id: bId,
      body: "[TEST] hello from B",
    });
    expect(error).toBeNull();
  });

  // (e) NO CROSS-READ: an outsider selecting that conversation's messages gets
  // zero rows, while the participant sees them. (Runs on the (b) conversation,
  // which now has a message.)
  test("e) outsider cannot read a conversation's messages", async () => {
    const { data: seenByB } = await B.from("messages")
      .select("id")
      .eq("conversation_id", coldConvId);
    expect(seenByB?.length ?? 0).toBeGreaterThan(0); // participant sees it

    const { data: seenByC } = await C.from("messages")
      .select("id")
      .eq("conversation_id", coldConvId);
    expect(seenByC?.length ?? 0).toBe(0); // outsider sees nothing
  });

  // (c) FREE PASS — the branch that proves the whole design. Because the
  // recipient ALREADY FOLLOWS the sender, the thread must NEVER enter Requests:
  // the recipient's participant row is created accepted = true, straight to Chats.
  test("c) free pass → recipient who follows sender is accepted = true", async () => {
    const convId = await freshConversation(FpA, fpBId);

    const recipRow = await participantRow(B, convId, fpBId);
    // LOUD: a follower's cold DM skips Requests entirely — the follow graph is
    // the spam filter. If this is ever false, the free pass is broken.
    expect(recipRow?.accepted).toBe(true);
  });

  // (d) IGNORE BLOCKS SENDER — security-critical. The recipient deletes their own
  // participant row (Ignore); the sender's next message INSERT must be REJECTED
  // by RLS, not silently dropped. Assert on the error.
  test("d) ignore (recipient deletes their row) blocks the sender's insert", async () => {
    ignoreConvId = await freshConversation(A, b2Id);

    const { error: delErr } = await B2.from("conversation_participants")
      .delete()
      .eq("conversation_id", ignoreConvId)
      .eq("user_id", b2Id);
    expect(delErr).toBeNull();

    const { error } = await A.from("messages").insert({
      conversation_id: ignoreConvId,
      sender_id: aId,
      body: "[TEST] this must be blocked",
    });
    expect(error).not.toBeNull();
  });

  // (h) The sender can't undo an Ignore by re-opening the thread: the existing
  // conversation is returned, but the recipient's row is NOT re-created.
  test("h) after ignore, sender re-opening doesn't re-create the recipient's row", async () => {
    const convId = await openConversation(A, b2Id);
    expect(convId).toBe(ignoreConvId);

    const b2Row = await participantRow(A, ignoreConvId, b2Id);
    expect(b2Row).toBeNull();

    const { error } = await A.from("messages").insert({
      conversation_id: ignoreConvId,
      sender_id: aId,
      body: "[TEST] still blocked after re-open",
    });
    expect(error).not.toBeNull();
  });

  // (i) The recipient CAN undo their own Ignore: re-opening re-creates only
  // their own row, accepted, and they can send again.
  test("i) after ignore, recipient re-opening re-creates only their own row", async () => {
    const convId = await openConversation(B2, aId);
    expect(convId).toBe(ignoreConvId);

    const b2Row = await participantRow(B2, ignoreConvId, b2Id);
    expect(b2Row?.accepted).toBe(true);

    const { data: rows } = await B2.from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", ignoreConvId);
    expect((rows ?? []).map((r) => r.user_id).sort()).toEqual(
      [aId, b2Id].sort()
    );

    const { error } = await B2.from("messages").insert({
      conversation_id: ignoreConvId,
      sender_id: b2Id,
      body: "[TEST] recipient un-ignored",
    });
    expect(error).toBeNull();
  });

  // (f) No direct participant inserts at all — not your own row, not the other
  // side's, not a third person's. 42501 = permission denied (the privilege check
  // runs before any constraint, so this is never a duplicate-key error).
  test("f) a party inserting any participant row directly is denied", async () => {
    for (const userId of [aId, bId, cId]) {
      const { error } = await A.from("conversation_participants").insert({
        conversation_id: coldConvId,
        user_id: userId,
        accepted: true,
      });
      expect(error?.code).toBe("42501");
    }
    // The outsider was not added.
    const cRow = await participantRow(A, coldConvId, cId);
    expect(cRow).toBeNull();
  });

  // (g) No direct conversation inserts.
  test("g) a client inserting into conversations directly is denied", async () => {
    await resetPair(A, cId);
    const [user_a, user_b] = canonical(aId, cId);
    const { error } = await A.from("conversations").insert({ user_a, user_b });
    expect(error?.code).toBe("42501");
  });

  // (j) Only accepted and last_read_at are updatable on your own row.
  test("j) updating own row's conversation_id or user_id is denied; last_read_at works", async () => {
    const { error: convErr } = await B.from("conversation_participants")
      .update({ conversation_id: ignoreConvId })
      .eq("conversation_id", coldConvId)
      .eq("user_id", bId);
    expect(convErr).not.toBeNull();

    const { error: userErr } = await B.from("conversation_participants")
      .update({ user_id: cId })
      .eq("conversation_id", coldConvId)
      .eq("user_id", bId);
    expect(userErr).not.toBeNull();

    // Row is still where it was, still B's.
    expect(await participantRow(B, coldConvId, bId)).not.toBeNull();
    expect(await participantRow(A, ignoreConvId, bId)).toBeNull();

    const readAt = new Date().toISOString();
    const { error: readErr } = await B.from("conversation_participants")
      .update({ last_read_at: readAt })
      .eq("conversation_id", coldConvId)
      .eq("user_id", bId);
    expect(readErr).toBeNull();
    const bRow = await participantRow(B, coldConvId, bId);
    expect(new Date(bRow!.last_read_at as string).getTime()).toBe(
      new Date(readAt).getTime()
    );
  });

  // (k) open_conversation refuses yourself and anyone who isn't an approved pro,
  // and creates nothing when it refuses.
  test("k) open_conversation with yourself or a pending pro errors and creates nothing", async () => {
    const { data: selfConv, error: selfErr } = await A.rpc("open_conversation", {
      p_other: aId,
    });
    expect(selfErr).not.toBeNull();
    expect(selfConv).toBeNull();

    await resetPair(A, pendingId);
    const { data: pendConv, error: pendErr } = await A.rpc("open_conversation", {
      p_other: pendingId,
    });
    expect(pendErr).not.toBeNull();
    expect(pendConv).toBeNull();

    const [user_a, user_b] = canonical(aId, pendingId);
    const { data: conv } = await A.from("conversations")
      .select("id")
      .eq("user_a", user_a)
      .eq("user_b", user_b)
      .maybeSingle();
    expect(conv).toBeNull();
  });

  // (l) Neither function is callable without signing in.
  test("l) reset_seed_conversation and open_conversation reject the anon key", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { error: openErr } = await anon.rpc("open_conversation", {
      p_other: bId,
    });
    expect(openErr?.code).toBe("42501");

    const { error: resetErr } = await anon.rpc("reset_seed_conversation", {
      p_other: bId,
    });
    expect(resetErr?.code).toBe("42501");
  });
});
