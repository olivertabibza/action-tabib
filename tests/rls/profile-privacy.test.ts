import { beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ADMIN_KEY,
  ADMIN_PASSWORD,
  getProfileId,
  seedEmail,
  signInAs,
} from "../helpers/auth";

/**
 * Profile privacy (audit ENG F04) — asserted at the DB level against
 * supabase/profile-privacy.sql.
 *
 *   * Nobody reads profiles.email through the table: the column has no SELECT
 *     grant, so asking for it is a permission error, not an empty value.
 *   * An approved pro sees only approved pros' and fans' rows, never a pending
 *     or rejected applicant's.
 *   * Everyone still reads their own row in full (minus email).
 *   * A project owner gets their applicants' login emails, and an admin gets
 *     any profile's, through two narrow security-definer functions.
 *
 * FIXTURE: seeded rows only, nothing is written. "Last Train to Lisbon" is
 * owned by director-1 and has seeded applications from actor-1 and actor-2.
 * director-2 is a seeded PENDING pro.
 *
 * ADMIN: seed-admin-1 signs in with SEED_ADMIN_PASSWORD. Without it, the admin
 * half of (f) skips visibly.
 *
 * SAFETY: reads and RPCs only, as seed accounts with the anon key.
 */

const PRO = "editor-1"; // approved pro, the "peer" reader
const OTHER_PRO = "composer-1"; // approved pro whose row PRO reads
const PENDING = "director-2"; // seeded PENDING pro
const OWNER = "director-1"; // owns PROJECT
const PROJECT = "Last Train to Lisbon"; // has seeded applicants
const HAS_ADMIN = !!ADMIN_PASSWORD;
const NO_ADMIN = "skipped: SEED_ADMIN_PASSWORD is unset";

let pro: SupabaseClient, owner: SupabaseClient;
let admin: SupabaseClient | null = null;
let proId: string, otherProId: string, pendingId: string, ownerId: string;
let projectId: string;

beforeAll(async () => {
  [pro, owner] = await Promise.all([signInAs(PRO), signInAs(OWNER)]);
  [proId, otherProId, pendingId, ownerId] = await Promise.all([
    getProfileId(PRO),
    getProfileId(OTHER_PRO),
    getProfileId(PENDING),
    getProfileId(OWNER),
  ]);

  const { data } = await owner
    .from("projects")
    .select("id")
    .eq("created_by", ownerId)
    .eq("title", PROJECT)
    .maybeSingle();
  if (!data) {
    throw new Error(
      `Missing seeded project "${PROJECT}" owned by ${OWNER}. Run \`npm run seed\`.`
    );
  }
  projectId = data.id as string;

  if (HAS_ADMIN) admin = await signInAs(ADMIN_KEY);
  else console.warn(`[profile-privacy] Admin half of (f) ${NO_ADMIN}.`);
});

describe("profile privacy", () => {
  test("a) an approved pro reads another approved pro's public columns", async () => {
    const { data, error } = await pro
      .from("profiles")
      .select("id, display_name, role, headline")
      .eq("id", otherProId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(otherProId);
    expect(data?.display_name).toBeTruthy();
    expect(data?.role).toBeTruthy();
    expect(data?.headline).toBeTruthy();
  });

  test("b) an approved pro selecting another profile's email gets permission denied", async () => {
    const { data, error } = await pro
      .from("profiles")
      .select("id, email")
      .eq("id", otherProId);
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  test("c) an approved pro gets zero rows for a pending pro", async () => {
    const { data, error } = await pro
      .from("profiles")
      .select("id")
      .eq("id", pendingId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  test("d) a user still reads their own account_type, application_status and is_admin", async () => {
    const { data, error } = await pro
      .from("profiles")
      .select("account_type, application_status, is_admin")
      .eq("id", proId)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      account_type: "professional",
      application_status: "approved",
      is_admin: false,
    });
  });

  test("e) project_applicant_emails: the owner gets one email per applicant; another pro gets none", async () => {
    const { data: apps, error: appsErr } = await owner
      .from("applications")
      .select("applicant_id")
      .eq("project_id", projectId);
    expect(appsErr).toBeNull();
    const applicantIds = [
      ...new Set((apps ?? []).map((a) => a.applicant_id as string)),
    ].sort();
    expect(applicantIds.length).toBeGreaterThan(0);

    const { data: rows, error } = await owner.rpc("project_applicant_emails", {
      p_project_id: projectId,
    });
    expect(error).toBeNull();
    const list = (rows ?? []) as { applicant_id: string; email: string }[];
    expect(list.map((r) => r.applicant_id).sort()).toEqual(applicantIds);
    for (const r of list) expect(r.email).toBeTruthy();

    const { data: peerRows, error: peerErr } = await pro.rpc(
      "project_applicant_emails",
      { p_project_id: projectId }
    );
    expect(peerErr).toBeNull();
    expect(peerRows ?? []).toHaveLength(0);
  });

  describe("f) admin_profile_emails", () => {
    test("a non-admin gets zero rows", async () => {
      const { data, error } = await pro.rpc("admin_profile_emails", {
        p_ids: [otherProId, pendingId],
      });
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    test.skipIf(!HAS_ADMIN)(
      `the admin gets the emails${HAS_ADMIN ? "" : ` (${NO_ADMIN})`}`,
      async () => {
        const { data, error } = await admin!.rpc("admin_profile_emails", {
          p_ids: [otherProId, pendingId],
        });
        expect(error).toBeNull();
        const byId = new Map(
          ((data ?? []) as { id: string; email: string }[]).map((r) => [
            r.id,
            r.email,
          ])
        );
        expect(byId.get(otherProId)).toBe(seedEmail(OTHER_PRO));
        expect(byId.get(pendingId)).toBe(seedEmail(PENDING));
        expect(byId.size).toBe(2);
      }
    );
  });
});
