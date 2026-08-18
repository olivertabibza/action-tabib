import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { signInAs, getProfileId } from "../helpers/auth";

/**
 * project_roles / role-level applications RLS — asserted at the DB level
 * against supabase/project-roles.sql.
 *
 * FIXTURE: three SEEDED projects, all owned by producer-1, so one owner client
 * can build and tear down everything:
 *   "Neon Saints"       open   — the project under test
 *   "Coastline"         open   — the OTHER project, for the cross-project check
 *   "Archive (wrapped)" closed — proves an owner still reads a closed project's
 *                                roles even though can_view_project()'s
 *                                approved-pro arm is false for it
 * Roles are created here, not seeded, and every one is named "[TEST] …".
 * actor-1 applies for them: they are an approved pro who neither owns nor has
 * a seeded application on "Neon Saints". director-2 is a seeded PENDING pro, so
 * is_approved_pro() — and therefore can_view_project() — is false for them.
 *
 * SAFETY / CLEANUP: acts only as seed accounts, anon key only. beforeAll clears
 * residue from a crashed run and afterAll removes everything this file created;
 * deleting a role cascades any application against it, so the roles delete is
 * the whole teardown. Fixture inserts are ASSERTED (error null) before any
 * denial test.
 */

const OWNER = "producer-1"; // owns all three fixture projects
const APPLICANT = "actor-1"; // approved pro, not the owner, no seeded application
const OTHER = "editor-1"; // approved pro, used for the "someone else's" check
const PENDING = "director-2"; // seed PENDING pro → is_approved_pro() false

const OPEN_PROJECT = "Neon Saints";
const OTHER_PROJECT = "Coastline";
const CLOSED_PROJECT = "Archive (wrapped)";

let owner: SupabaseClient, applicant: SupabaseClient;
let other: SupabaseClient, pending: SupabaseClient;
let ownerId: string, applicantId: string;
let openProjectId: string, otherProjectId: string, closedProjectId: string;
let roleOneId: string, roleTwoId: string;
let crossProjectRoleId: string, closedRoleId: string;

/** Every project id this file touches, for the "[TEST] …" role sweep. */
const fixtureProjectIds = () => [openProjectId, otherProjectId, closedProjectId];

/** Roles cascade to their applications, so this is the entire teardown. */
async function clearTestRoles() {
  await owner
    .from("project_roles")
    .delete()
    .in("project_id", fixtureProjectIds())
    .like("name", "[TEST]%");
}

/** The seeded project id by title, read as its owner (who always sees it). */
async function seededProjectId(title: string): Promise<string> {
  const { data } = await owner
    .from("projects")
    .select("id")
    .eq("created_by", ownerId)
    .eq("title", title)
    .maybeSingle();
  if (!data) {
    throw new Error(
      `Missing seeded project "${title}" owned by ${OWNER}. Run \`npm run seed\`.`
    );
  }
  return data.id as string;
}

beforeAll(async () => {
  [owner, applicant, other, pending] = await Promise.all([
    signInAs(OWNER),
    signInAs(APPLICANT),
    signInAs(OTHER),
    signInAs(PENDING),
  ]);
  [ownerId, applicantId] = await Promise.all([
    getProfileId(OWNER),
    getProfileId(APPLICANT),
  ]);

  [openProjectId, otherProjectId, closedProjectId] = await Promise.all([
    seededProjectId(OPEN_PROJECT),
    seededProjectId(OTHER_PROJECT),
    seededProjectId(CLOSED_PROJECT),
  ]);

  await clearTestRoles();

  const { data: roles, error: roleErr } = await owner
    .from("project_roles")
    .insert([
      {
        project_id: openProjectId,
        name: "[TEST] Role One",
        billing: "lead",
        gender: "female",
        age_min: 22,
        age_max: 30,
        sort_order: 0,
      },
      {
        project_id: openProjectId,
        name: "[TEST] Role Two",
        billing: "crew",
        gender: "any",
        sort_order: 1,
      },
      {
        project_id: otherProjectId,
        name: "[TEST] Cross-project Role",
        billing: "crew",
        gender: "any",
        sort_order: 0,
      },
      {
        project_id: closedProjectId,
        name: "[TEST] Closed Role",
        billing: "crew",
        gender: "any",
        sort_order: 0,
      },
    ])
    .select("id, name");
  expect(roleErr).toBeNull();
  expect(roles ?? []).toHaveLength(4);

  const idByName = new Map(
    (roles ?? []).map((r: { id: string; name: string }) => [r.name, r.id])
  );
  roleOneId = idByName.get("[TEST] Role One")!;
  roleTwoId = idByName.get("[TEST] Role Two")!;
  crossProjectRoleId = idByName.get("[TEST] Cross-project Role")!;
  closedRoleId = idByName.get("[TEST] Closed Role")!;
});

afterAll(async () => {
  await clearTestRoles();
});

describe("project_roles RLS", () => {
  // (a) can_view_project()'s open-project arm: the roles of an open project are
  // readable by any approved pro, owner or not.
  test("a) an approved pro reads the roles of an open project", async () => {
    const { data, error } = await applicant
      .from("project_roles")
      .select("id, name")
      .eq("project_id", openProjectId);
    expect(error).toBeNull();
    const ids = (data ?? []).map((r: { id: string }) => r.id);
    expect(ids).toContain(roleOneId);
    expect(ids).toContain(roleTwoId);
  });

  // (b) The same query as a PENDING pro. is_approved_pro() is false, they don't
  // own the project and haven't applied, so can_view_project() is false and the
  // SELECT policy filters every row out — no error, just nothing.
  test("b) a pending pro reads zero roles", async () => {
    const { data, error } = await pending
      .from("project_roles")
      .select("id")
      .eq("project_id", openProjectId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  // (c) can_view_project()'s owner arm. The project is CLOSED, so the
  // approved-pro arm is false for everyone — only created_by = auth.uid() can
  // carry this read.
  test("c) an owner reads the roles of their own closed project", async () => {
    const { data, error } = await owner
      .from("project_roles")
      .select("id")
      .eq("project_id", closedProjectId);
    expect(error).toBeNull();
    expect((data ?? []).map((r: { id: string }) => r.id)).toContain(closedRoleId);
  });

  // (d) The INSERT policy is owner-only: being able to READ a project's roles
  // does not confer the right to add one.
  test("d) a non-owner cannot insert a role into someone else's project", async () => {
    const { error } = await applicant
      .from("project_roles")
      .insert({ project_id: openProjectId, name: "[TEST] Intruder" });
    expect(error).not.toBeNull();
  });

  // (e) The owner's full write path, end to end.
  test("e) an owner can insert, update and delete roles on their own project", async () => {
    const { data: inserted, error: insertErr } = await owner
      .from("project_roles")
      .insert({
        project_id: openProjectId,
        name: "[TEST] Owner CRUD Role",
        billing: "supporting",
        gender: "male",
        age_min: 40,
        age_max: 55,
        sort_order: 9,
      })
      .select("id, status");
    expect(insertErr).toBeNull();
    expect(inserted ?? []).toHaveLength(1);
    const crudRoleId = inserted![0].id as string;

    const { data: updated, error: updateErr } = await owner
      .from("project_roles")
      .update({ status: "filled" })
      .eq("id", crudRoleId)
      .select("status");
    expect(updateErr).toBeNull();
    expect(updated ?? []).toHaveLength(1);
    expect(updated![0].status).toBe("filled");

    const { data: deleted, error: deleteErr } = await owner
      .from("project_roles")
      .delete()
      .eq("id", crudRoleId)
      .select("id");
    expect(deleteErr).toBeNull();
    expect(deleted ?? []).toHaveLength(1);
  });
});

describe("role-level applications", () => {
  // (f) The happy path: an approved pro applies for one specific role.
  test("f) an approved pro can apply for a role", async () => {
    const { error } = await applicant.from("applications").insert({
      project_id: openProjectId,
      applicant_id: applicantId,
      role_id: roleOneId,
      note: "[TEST] applying for role one",
    });
    expect(error).toBeNull();
  });

  // (g) applications_role_applicant_uniq (partial, role_id not null): one
  // application per person per role, so this is a unique violation, not a
  // policy denial.
  test("g) the same pro cannot apply for that same role twice", async () => {
    const { error } = await applicant.from("applications").insert({
      project_id: openProjectId,
      applicant_id: applicantId,
      role_id: roleOneId,
      note: "[TEST] duplicate",
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("23505");
  });

  // (h) The reason the old unique (project_id, applicant_id) constraint had to
  // go: every role has its own Apply pill, so two roles on ONE production must
  // both be applicable for.
  test("h) the same pro can apply for a second role on the same project", async () => {
    const { error } = await applicant.from("applications").insert({
      project_id: openProjectId,
      applicant_id: applicantId,
      role_id: roleTwoId,
      note: "[TEST] applying for role two",
    });
    expect(error).toBeNull();
  });

  // (i) role_belongs_to_project() via the applications_check_role_project
  // trigger. Both halves are individually legal — the project is open and not
  // owned by the applicant, and the role exists — but they don't match.
  test("i) an application whose role belongs to another project is rejected", async () => {
    const { error } = await applicant.from("applications").insert({
      project_id: openProjectId,
      applicant_id: applicantId,
      role_id: crossProjectRoleId,
      note: "[TEST] mismatched role",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/does not belong/);
  });

  // (j) has_applied_to_role() is scoped to auth.uid(): it answers for the
  // CALLER, never leaking whether anyone else applied.
  test("j) has_applied_to_role() is true for the caller's own application only", async () => {
    const { data: mine, error: mineErr } = await applicant.rpc(
      "has_applied_to_role",
      { p_role_id: roleOneId }
    );
    expect(mineErr).toBeNull();
    expect(mine).toBe(true);

    const { data: theirs, error: theirsErr } = await other.rpc(
      "has_applied_to_role",
      { p_role_id: roleOneId }
    );
    expect(theirsErr).toBeNull();
    expect(theirs).toBe(false);
  });
});
