import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getProfileId, signInAs } from "../helpers/auth";

/**
 * Portfolio storage (supabase/portfolios.sql), asserted with the anon key as
 * seed accounts. director-2 is a seeded PENDING pro, so the "approved pros are
 * public" rule doesn't cover their files: only they (and admins) may read them.
 *
 * SAFETY / CLEANUP: every file uploaded here is deleted in afterAll by its
 * owner. Nothing touches real users or existing portfolio files.
 */

const PENDING = "director-2";
const OTHER = "actor-1";

const TINY_PDF = new Blob([new TextEncoder().encode("%PDF-1.4\n%%EOF\n")], {
  type: "application/pdf",
});

let pending: SupabaseClient, other: SupabaseClient;
let pendingId: string;
let pendingFile: string;
const uploadedByPending: string[] = [];

beforeAll(async () => {
  [pending, other] = await Promise.all([signInAs(PENDING), signInAs(OTHER)]);
  pendingId = await getProfileId(PENDING);
  pendingFile = `${pendingId}/${crypto.randomUUID()}/rls-check.pdf`;
});

afterAll(async () => {
  if (uploadedByPending.length > 0) {
    await pending.storage.from("portfolios").remove(uploadedByPending);
  }
});

describe("portfolio files", () => {
  test("a) an applicant uploads into their own folder", async () => {
    const { error } = await pending.storage
      .from("portfolios")
      .upload(pendingFile, TINY_PDF, { contentType: "application/pdf" });
    expect(error).toBeNull();
    uploadedByPending.push(pendingFile);
  });

  test("b) nobody can upload into someone else's folder", async () => {
    const { error } = await other.storage
      .from("portfolios")
      .upload(`${pendingId}/${crypto.randomUUID()}/intruder.pdf`, TINY_PDF, {
        contentType: "application/pdf",
      });
    expect(error).not.toBeNull();
  });

  test("c) the owner can open their own file", async () => {
    const { data, error } = await pending.storage
      .from("portfolios")
      .createSignedUrl(pendingFile, 60);
    expect(error).toBeNull();
    expect(data?.signedUrl).toBeTruthy();
  });

  test("d) another member can't open a pending applicant's file", async () => {
    const { data } = await other.storage
      .from("portfolios")
      .createSignedUrl(pendingFile, 60);
    expect(data?.signedUrl ?? null).toBeNull();
  });

  test("e) another member can't list a pending applicant's folder", async () => {
    const { data } = await other.storage.from("portfolios").list(pendingId);
    expect(data ?? []).toHaveLength(0);
  });

  test("f) the owner can delete their own file", async () => {
    const path = `${pendingId}/${crypto.randomUUID()}/rls-delete.pdf`;
    const up = await pending.storage
      .from("portfolios")
      .upload(path, TINY_PDF, { contentType: "application/pdf" });
    expect(up.error).toBeNull();
    const { data, error } = await pending.storage
      .from("portfolios")
      .remove([path]);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });
});
