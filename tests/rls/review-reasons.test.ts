import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ADMIN_KEY,
  ADMIN_PASSWORD,
  getProfileId,
  signInAs,
} from "../helpers/auth";

/**
 * Review reasons (supabase/review-reasons.sql), asserted with the anon key as
 * seed accounts. The reason is about director-2, a seeded PENDING pro (item
 * type 'profile'); actor-1 is an approved pro who must never see it.
 *
 * ADMIN: seed-admin-1 signs in with SEED_ADMIN_PASSWORD. Without it, the tests
 * that need an admin-written reason skip visibly.
 *
 * SAFETY / CLEANUP: the one reason written here is deleted in afterAll.
 */

const SUBJECT = "director-2";
const OTHER = "actor-1";
const HAS_ADMIN = !!ADMIN_PASSWORD;
const NO_ADMIN = "skipped: SEED_ADMIN_PASSWORD is unset";
const REASON = "[TEST] Please add a reel or credits and apply again.";

let subject: SupabaseClient, other: SupabaseClient;
let admin: SupabaseClient | null = null;
let subjectId: string;

const readReason = (client: SupabaseClient) =>
  client
    .from("review_reasons")
    .select("reason, subject_id")
    .eq("item_type", "profile")
    .eq("item_id", subjectId);

beforeAll(async () => {
  [subject, other] = await Promise.all([signInAs(SUBJECT), signInAs(OTHER)]);
  subjectId = await getProfileId(SUBJECT);
  if (HAS_ADMIN) {
    admin = await signInAs(ADMIN_KEY);
  } else {
    console.warn(`[review-reasons] Admin tests ${NO_ADMIN}.`);
  }
});

afterAll(async () => {
  if (admin) {
    await admin
      .from("review_reasons")
      .delete()
      .eq("item_type", "profile")
      .eq("item_id", subjectId);
  }
});

describe("review reasons", () => {
  test("a) a non-admin can't write a reason", async () => {
    const { error } = await other.from("review_reasons").insert({
      item_type: "profile",
      item_id: subjectId,
      reason: "[TEST] written by a member",
    });
    expect(error).not.toBeNull();
  });

  describe.skipIf(!HAS_ADMIN)(
    `with an admin${HAS_ADMIN ? "" : ` (${NO_ADMIN})`}`,
    () => {
      test("b) an admin writes a reason, and the subject is filled in", async () => {
        const { data, error } = await admin!
          .from("review_reasons")
          .upsert(
            { item_type: "profile", item_id: subjectId, reason: REASON },
            { onConflict: "item_type,item_id" }
          )
          .select("subject_id");
        expect(error).toBeNull();
        expect(data?.[0]?.subject_id).toBe(subjectId);
      });

      test("c) the subject reads their own reason", async () => {
        const { data, error } = await readReason(subject);
        expect(error).toBeNull();
        expect(data ?? []).toHaveLength(1);
        expect(data![0].reason).toBe(REASON);
      });

      test("d) another approved pro reads nothing", async () => {
        const { data } = await readReason(other);
        expect(data ?? []).toHaveLength(0);
      });

      test("e) a non-admin can't change or delete the reason", async () => {
        const updated = await other
          .from("review_reasons")
          .update({ reason: "[TEST] changed by a member" })
          .eq("item_type", "profile")
          .eq("item_id", subjectId)
          .select("reason");
        expect(updated.data ?? []).toHaveLength(0);

        const fromSubject = await subject
          .from("review_reasons")
          .delete()
          .eq("item_type", "profile")
          .eq("item_id", subjectId)
          .select("reason");
        expect(fromSubject.data ?? []).toHaveLength(0);

        const { data } = await readReason(subject);
        expect(data?.[0]?.reason).toBe(REASON);
      });
    }
  );
});
