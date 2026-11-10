import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ADMIN_KEY,
  ADMIN_PASSWORD,
  getProfileId,
  signInAs,
} from "../helpers/auth";

/**
 * Profile photos (supabase/avatars.sql) and the public_profiles view
 * (supabase/public-profiles.sql), asserted with the anon key as seed accounts.
 *
 * SAFETY / CLEANUP: ME's avatar_path is put back to what it was, and every
 * file uploaded here is deleted in afterAll. Nothing touches real users.
 */

const ME = "actor-1";
const OTHER = "actor-2";
const HAS_ADMIN = !!ADMIN_PASSWORD;
const NO_ADMIN = "skipped: SEED_ADMIN_PASSWORD is unset";

// A few bytes labelled as PNG; the bucket checks the declared type, not pixels.
const TINY_PNG = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], {
  type: "image/png",
});

let me: SupabaseClient;
let meId: string, otherId: string;
let originalPath: string | null = null;
const uploaded: string[] = [];

beforeAll(async () => {
  me = await signInAs(ME);
  [meId, otherId] = await Promise.all([getProfileId(ME), getProfileId(OTHER)]);
  const { data } = await me
    .from("profiles")
    .select("avatar_path")
    .eq("id", meId)
    .single();
  originalPath = (data?.avatar_path as string | null) ?? null;
});

afterAll(async () => {
  await me.from("profiles").update({ avatar_path: originalPath }).eq("id", meId);
  if (uploaded.length > 0) await me.storage.from("avatars").remove(uploaded);
});

describe("profile photos", () => {
  test("a) a member uploads a photo into their own folder", async () => {
    const path = `${meId}/${crypto.randomUUID()}.png`;
    const { error } = await me.storage
      .from("avatars")
      .upload(path, TINY_PNG, { contentType: "image/png" });
    expect(error).toBeNull();
    uploaded.push(path);
  });

  test("b) a member can't upload into someone else's folder", async () => {
    const path = `${otherId}/${crypto.randomUUID()}.png`;
    const { error } = await me.storage
      .from("avatars")
      .upload(path, TINY_PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  test("c) avatar_path must point into the member's own folder", async () => {
    const own = await me
      .from("profiles")
      .update({ avatar_path: `${meId}/check.png` })
      .eq("id", meId)
      .select("avatar_path");
    expect(own.error).toBeNull();
    expect(own.data?.[0]?.avatar_path).toBe(`${meId}/check.png`);

    const foreign = await me
      .from("profiles")
      .update({ avatar_path: `${otherId}/check.png` })
      .eq("id", meId);
    expect(foreign.error).not.toBeNull(); // profiles_avatar_path_own_folder
  });

  test("d) public_profiles includes the photo path", async () => {
    const { data, error } = await me
      .from("public_profiles")
      .select("id, avatar_path")
      .eq("id", meId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(meId);
    expect(data).toHaveProperty("avatar_path");
  });

  test.skipIf(!HAS_ADMIN)(
    `e) public_profiles leaves out admins${HAS_ADMIN ? "" : ` (${NO_ADMIN})`}`,
    async () => {
      const adminId = await getProfileId(ADMIN_KEY);
      const { data, error } = await me
        .from("public_profiles")
        .select("id")
        .eq("id", adminId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    }
  );
});
