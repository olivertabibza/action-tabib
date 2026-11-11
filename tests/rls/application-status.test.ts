import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getProfileId, signInAs } from "../helpers/auth";

/**
 * Application status (supabase/application-status.sql), asserted with the anon
 * key as seed accounts.
 *
 * FIXTURE: the seeded project "Staged", owned by writer-1, where director-1 has
 * applied for the Director role. actor-2 is an approved pro who neither owns
 * "Staged" nor applied to it. Nothing is created; the one application's status
 * is put back to 'submitted' in afterAll.
 */

const OWNER = "writer-1";
const APPLICANT = "director-1";
const OTHER = "actor-2";
const PROJECT = "Staged";

let owner: SupabaseClient, applicant: SupabaseClient, other: SupabaseClient;
let applicationId: string;
let originalNote: string;

async function readStatus(): Promise<string> {
  const { data, error } = await owner
    .from("applications")
    .select("status")
    .eq("id", applicationId)
    .single();
  expect(error).toBeNull();
  return data!.status as string;
}

async function setStatus(client: SupabaseClient, status: string) {
  return client
    .from("applications")
    .update({ status })
    .eq("id", applicationId)
    .select("status");
}

beforeAll(async () => {
  [owner, applicant, other] = await Promise.all([
    signInAs(OWNER),
    signInAs(APPLICANT),
    signInAs(OTHER),
  ]);
  const [ownerId, applicantId] = await Promise.all([
    getProfileId(OWNER),
    getProfileId(APPLICANT),
  ]);

  const { data: project } = await owner
    .from("projects")
    .select("id")
    .eq("created_by", ownerId)
    .eq("title", PROJECT)
    .maybeSingle();
  if (!project) {
    throw new Error(
      `Missing seeded project "${PROJECT}" owned by ${OWNER}. Run \`npm run seed\`.`
    );
  }

  const { data: app, error } = await owner
    .from("applications")
    .select("id, note")
    .eq("project_id", project.id)
    .eq("applicant_id", applicantId)
    .limit(1)
    .single();
  expect(error).toBeNull();
  applicationId = app!.id as string;
  originalNote = app!.note as string;

  const { error: resetErr } = await setStatus(owner, "submitted");
  expect(resetErr).toBeNull();
});

afterAll(async () => {
  await setStatus(owner, "submitted");
});

describe("application status", () => {
  test("a) the owner shortlists, declines and resets to submitted", async () => {
    for (const status of ["shortlisted", "declined", "submitted"]) {
      const { data, error } = await setStatus(owner, status);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(1);
      expect(await readStatus()).toBe(status);
    }
  });

  test("b) the owner can't set a status outside the three", async () => {
    const { error } = await setStatus(owner, "approved");
    expect(error).not.toBeNull();
    expect(await readStatus()).toBe("submitted");
  });

  test("c) the owner can't change note or role_id", async () => {
    const note = await owner
      .from("applications")
      .update({ note: "[TEST] rewritten by the owner" })
      .eq("id", applicationId);
    expect(note.error).not.toBeNull();

    const role = await owner
      .from("applications")
      .update({ role_id: null })
      .eq("id", applicationId);
    expect(role.error).not.toBeNull();

    const { data } = await owner
      .from("applications")
      .select("note, role_id")
      .eq("id", applicationId)
      .single();
    expect(data!.note).toBe(originalNote);
    expect(data!.role_id).not.toBeNull();
  });

  test("d) the applicant changing their own status changes nothing", async () => {
    const { data } = await setStatus(applicant, "shortlisted");
    expect(data ?? []).toHaveLength(0);
    expect(await readStatus()).toBe("submitted");
  });

  test("e) another approved pro changes nothing", async () => {
    const { data } = await setStatus(other, "declined");
    expect(data ?? []).toHaveLength(0);
    expect(await readStatus()).toBe("submitted");
  });
});
