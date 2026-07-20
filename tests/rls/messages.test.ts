import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { signInAs, getProfileId } from "../helpers/auth";

/**
 * Messages RLS — the five hand-tested branches, asserted at the DB level (no
 * browser). These replicate what openConversation()/sendMessage() do (normalise
 * the pair, seed both participant rows, compute the free pass from `follows`),
 * then check what the policies in supabase/messages.sql actually allow.
 *
 * SAFETY / CLEANUP (see the approved strategy):
 *   - Acts only as seed accounts; every message body is "[TEST]"-prefixed.
 *   - conversation_participants ARE deletable by their owner, so afterAll deletes
 *     the participant rows these tests created (via each owner's client).
 *   - conversations and messages are append-only by design (no DELETE policy), so
 *     a bounded, [TEST]-tagged, seed-only residue is expected: conversations are
 *     unique per pair (reused, don't grow) and probe messages are guarded to one.
 *
 * Pair choices depend on the seed follow graph:
 *   - COLD/IGNORE/CROSS-READ need a recipient who does NOT follow the sender.
 *     actor-1 and actor-2 don't follow composer-1 → cold DMs.
 *   - FREE PASS needs a recipient who DOES follow the sender. actor-1 follows
 *     director-1 in the seed → free pass.
 */

// Sender for the cold-DM family, and the two recipients / outsider.
const SENDER = "composer-1";
const RECIP = "actor-1"; // does not follow composer-1 → cold
const RECIP2 = "actor-2"; // does not follow composer-1 → cold (used for Ignore)
const OUTSIDER = "writer-1"; // never a participant → can't cross-read
// Free-pass pair: recipient FOLLOWS sender.
const FP_SENDER = "director-1";
const FP_RECIP = "actor-1"; // follows director-1 in the seed

let A: SupabaseClient; // SENDER
let B: SupabaseClient; // RECIP
let B2: SupabaseClient; // RECIP2
let C: SupabaseClient; // OUTSIDER
let FpA: SupabaseClient; // FP_SENDER
let aId: string, bId: string, b2Id: string, cId: string;
let fpAId: string, fpBId: string;

// Conversations created during the run (shared across ordered tests below).
let coldConvId: string;

/** Canonical (user_a < user_b) ordering — the whole model depends on it. */
function canonical(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

/**
 * Find-or-create the conversation for a pair, then CLEAR both participant rows
 * (each owner deletes their own) so every run starts from a known-empty state —
 * the conversation row itself is reused (can't be deleted; unique per pair).
 * Returns the conversation id.
 */
async function freshConversation(
  senderClient: SupabaseClient,
  recipientClient: SupabaseClient,
  senderId: string,
  recipientId: string
): Promise<string> {
  const [user_a, user_b] = canonical(senderId, recipientId);

  let { data: conv } = await senderClient
    .from("conversations")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();
  if (!conv) {
    const { data, error } = await senderClient
      .from("conversations")
      .insert({ user_a, user_b })
      .select("id")
      .single();
    expect(error).toBeNull();
    conv = data;
  }
  const convId = conv!.id as string;

  await senderClient
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", convId)
    .eq("user_id", senderId);
  await recipientClient
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", convId)
    .eq("user_id", recipientId);

  return convId;
}

/** Does `recipientId` follow `senderId`? (The free-pass check openConversation
 *  runs — the sender may read follows where following_id = themselves.) */
async function recipientFollowsSender(
  senderClient: SupabaseClient,
  senderId: string,
  recipientId: string
): Promise<boolean> {
  const { data } = await senderClient
    .from("follows")
    .select("follower_id")
    .eq("follower_id", recipientId)
    .eq("following_id", senderId)
    .maybeSingle();
  return !!data;
}

/** Seed both participant rows as the sender: mine accepted, theirs by free pass. */
async function seedParticipants(
  senderClient: SupabaseClient,
  convId: string,
  senderId: string,
  recipientId: string,
  recipientAccepted: boolean
) {
  const { error } = await senderClient.from("conversation_participants").insert([
    { conversation_id: convId, user_id: senderId, accepted: true },
    { conversation_id: convId, user_id: recipientId, accepted: recipientAccepted },
  ]);
  expect(error).toBeNull();
}

beforeAll(async () => {
  [A, B, B2, C, FpA] = await Promise.all([
    signInAs(SENDER),
    signInAs(RECIP),
    signInAs(RECIP2),
    signInAs(OUTSIDER),
    signInAs(FP_SENDER),
  ]);
  [aId, bId, b2Id, cId, fpAId, fpBId] = await Promise.all([
    getProfileId(SENDER),
    getProfileId(RECIP),
    getProfileId(RECIP2),
    getProfileId(OUTSIDER),
    getProfileId(FP_SENDER),
    getProfileId(FP_RECIP),
  ]);
});

afterAll(async () => {
  // Delete only the participant rows we created, each as its owner. Conversations
  // and any probe messages are append-only (documented, bounded residue).
  const dp = (c: SupabaseClient, conv: string, uid: string) =>
    c
      .from("conversation_participants")
      .delete()
      .eq("conversation_id", conv)
      .eq("user_id", uid);

  if (coldConvId) {
    await dp(A, coldConvId, aId);
    await dp(B, coldConvId, bId);
  }
  // Ignore pair (composer-1 ↔ actor-2): B2 already deleted its own row in the
  // test; remove the sender's row too.
  const [ua, ub] = canonical(aId, b2Id);
  const { data: ignoreConv } = await A.from("conversations")
    .select("id")
    .eq("user_a", ua)
    .eq("user_b", ub)
    .maybeSingle();
  if (ignoreConv) await dp(A, ignoreConv.id as string, aId);
  // Free-pass pair (director-1 ↔ actor-1).
  const [fa, fb] = canonical(fpAId, fpBId);
  const { data: fpConv } = await FpA.from("conversations")
    .select("id")
    .eq("user_a", fa)
    .eq("user_b", fb)
    .maybeSingle();
  if (fpConv) {
    await dp(FpA, fpConv.id as string, fpAId);
    await dp(B, fpConv.id as string, fpBId); // actor-1 owns its side
  }
});

describe("messages RLS", () => {
  // (a) COLD DM: a recipient who doesn't follow the sender lands in Requests,
  // expressed as data: their participant row is accepted = false.
  test("a) cold DM → recipient participant accepted = false (Requests)", async () => {
    coldConvId = await freshConversation(A, B, aId, bId);

    const freePass = await recipientFollowsSender(A, aId, bId);
    expect(freePass).toBe(false); // actor-1 does not follow composer-1
    await seedParticipants(A, coldConvId, aId, bId, freePass);

    const { data: bRow } = await B.from("conversation_participants")
      .select("accepted")
      .eq("conversation_id", coldConvId)
      .eq("user_id", bId)
      .single();
    expect(bRow?.accepted).toBe(false);
  });

  // (b) ACCEPT: the recipient flips their OWN row to accepted, then can send.
  test("b) recipient accepts → row flips true, and B can send", async () => {
    const { error: upErr } = await B.from("conversation_participants")
      .update({ accepted: true })
      .eq("conversation_id", coldConvId)
      .eq("user_id", bId);
    expect(upErr).toBeNull();

    const { data: bRow } = await B.from("conversation_participants")
      .select("accepted")
      .eq("conversation_id", coldConvId)
      .eq("user_id", bId)
      .single();
    expect(bRow?.accepted).toBe(true);

    // Send is allowed now. Guard to one probe message (append-only table).
    const { data: existing } = await B.from("messages")
      .select("id")
      .eq("conversation_id", coldConvId)
      .eq("sender_id", bId)
      .limit(1);
    if (!existing?.length) {
      const { error } = await B.from("messages").insert({
        conversation_id: coldConvId,
        sender_id: bId,
        body: "[TEST] hello from B",
      });
      expect(error).toBeNull();
    }
    const { data: fromB } = await B.from("messages")
      .select("id")
      .eq("conversation_id", coldConvId)
      .eq("sender_id", bId)
      .limit(1);
    expect(fromB?.length ?? 0).toBeGreaterThan(0);
  });

  // (e) NO CROSS-READ: an outsider selecting that conversation's messages gets
  // zero rows, while the participant sees them. (Runs on the (b) conversation,
  // which now has a message.)
  test("e) outsider cannot read a conversation's messages", async () => {
    const { data: seenByB } = await B.from("messages")
      .select("id")
      .eq("conversation_id", coldConvId);
    expect((seenByB?.length ?? 0)).toBeGreaterThan(0); // participant sees it

    const { data: seenByC } = await C.from("messages")
      .select("id")
      .eq("conversation_id", coldConvId);
    expect(seenByC?.length ?? 0).toBe(0); // outsider sees nothing
  });

  // (c) FREE PASS — the branch that proves the whole design. Because the
  // recipient ALREADY FOLLOWS the sender, the thread must NEVER enter Requests:
  // the recipient's participant row is created accepted = true, straight to Chats.
  test("c) free pass → recipient who follows sender is accepted = true", async () => {
    // Sanity: the seed graph really does have actor-1 following director-1.
    const follows = await recipientFollowsSender(FpA, fpAId, fpBId);
    expect(follows).toBe(true);

    const convId = await freshConversation(FpA, B, fpAId, fpBId);
    await seedParticipants(FpA, convId, fpAId, fpBId, follows);

    const { data: recipRow } = await B.from("conversation_participants")
      .select("accepted")
      .eq("conversation_id", convId)
      .eq("user_id", fpBId)
      .single();
    // LOUD: a follower's cold DM skips Requests entirely — the follow graph is
    // the spam filter. If this is ever false, the free pass is broken.
    expect(recipRow?.accepted).toBe(true);
  });

  // (d) IGNORE BLOCKS SENDER — security-critical. The recipient deletes their own
  // participant row (Ignore); the sender's next message INSERT must be REJECTED
  // by RLS, not silently dropped. Assert on the error.
  test("d) ignore (recipient deletes their row) blocks the sender's insert", async () => {
    const convId = await freshConversation(A, B2, aId, b2Id);
    const freePass = await recipientFollowsSender(A, aId, b2Id);
    await seedParticipants(A, convId, aId, b2Id, freePass);

    // Recipient ignores: deletes their own participant row.
    const { error: delErr } = await B2.from("conversation_participants")
      .delete()
      .eq("conversation_id", convId)
      .eq("user_id", b2Id);
    expect(delErr).toBeNull();

    // Sender can no longer insert — the "other participant still exists" clause
    // of the messages insert policy now fails.
    const { error } = await A.from("messages").insert({
      conversation_id: convId,
      sender_id: aId,
      body: "[TEST] this must be blocked",
    });
    expect(error).not.toBeNull();
  });
});
