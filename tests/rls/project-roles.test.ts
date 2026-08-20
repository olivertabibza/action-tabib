import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { signInAs, getProfileId } from "../helpers/auth";

/**
 * project_roles / role-level applications RLS — asserted at the DB level
 * against supabase/project-roles.sql, plus the circle-applied counts in
 * supabase/projects-saved.sql, which live here because the two applications
 * test (h) creates ARE the fixture that broke them.
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
 * (k) shares NONE of that. It builds its own project, roles, connection and
 * applications between composer-1 and cinematographer-1 — see the fixture note
 * in beforeAll for why it cannot borrow any of them. That project is one stable
 * get-or-created row, reopened for the run and closed again after it.
 *
 * SAFETY / CLEANUP: acts only as seed accounts, anon key only. beforeAll clears
 * residue from a crashed run and afterAll clears everything this file created.
 * Deleting a role cascades any application against it, so the roles delete is
 * the whole teardown for the applications too; (k) additionally CLOSES its own
 * project, which public.projects has no DELETE policy to remove (deliberately —
 * docs/DECISIONS.md). Fixture inserts are ASSERTED (error null) before any
 * denial test, and (k)'s sweep is asserted too — see beforeAll.
 */

const OWNER = "producer-1"; // owns all three fixture projects
const APPLICANT = "actor-1"; // approved pro, not the owner, no seeded application
const OTHER = "editor-1"; // approved pro, used for the "someone else's" check
const PENDING = "director-2"; // seed PENDING pro → is_approved_pro() false
const CIRCLE_VIEWER = "composer-1"; // (k): owns its project, calls the RPCs
const CIRCLE_APPLICANT = "cinematographer-1"; // (k): applies for BOTH its roles

const OPEN_PROJECT = "Neon Saints";
const OTHER_PROJECT = "Coastline";
const CLOSED_PROJECT = "Archive (wrapped)";
const CIRCLE_PROJECT = "[TEST] Circle Count Fixture"; // created here, not seeded

let owner: SupabaseClient, applicant: SupabaseClient;
let other: SupabaseClient, pending: SupabaseClient;
let viewer: SupabaseClient, circleApplicant: SupabaseClient;
let ownerId: string, applicantId: string;
let viewerId: string, circleApplicantId: string;
let openProjectId: string, otherProjectId: string, closedProjectId: string;
let roleOneId: string, roleTwoId: string;
let crossProjectRoleId: string, closedRoleId: string;
let circleProjectId: string;

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

/** (k)'s project row, if it exists. Matched by (created_by, title), so this
 *  answers before circleProjectId is known. */
async function findCircleProject(): Promise<string | null> {
  const { data } = await viewer
    .from("projects")
    .select("id")
    .eq("created_by", viewerId)
    .eq("title", CIRCLE_PROJECT)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/**
 * (k)'s teardown, and its pre-run sweep: its roles (which cascade to its
 * applications), its connection, and the project CLOSED.
 *
 * Closed, not deleted, because public.projects has no DELETE policy — that is
 * deliberate, not an oversight (docs/DECISIONS.md). Closing is what makes the
 * row harmless: /projects filters on status = 'open', and can_view_project()'s
 * approved-pro arm is false for a closed project, so once the applications are
 * gone the only person who can see it is its owner. One stable row is reused
 * across runs rather than one being created and abandoned per run.
 */
async function clearCircleFixture() {
  const id = await findCircleProject();
  if (id) {
    await viewer
      .from("project_roles")
      .delete()
      .eq("project_id", id)
      .like("name", "[TEST]%");
    await viewer.from("projects").update({ status: "closed" }).eq("id", id);
  }
  await viewer
    .from("connections")
    .delete()
    .or(
      `and(requester_id.eq.${viewerId},addressee_id.eq.${circleApplicantId}),` +
        `and(requester_id.eq.${circleApplicantId},addressee_id.eq.${viewerId})`
    );
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
  [owner, applicant, other, pending, viewer, circleApplicant] = await Promise.all([
    signInAs(OWNER),
    signInAs(APPLICANT),
    signInAs(OTHER),
    signInAs(PENDING),
    signInAs(CIRCLE_VIEWER),
    signInAs(CIRCLE_APPLICANT),
  ]);
  [ownerId, applicantId, viewerId, circleApplicantId] = await Promise.all([
    getProfileId(OWNER),
    getProfileId(APPLICANT),
    getProfileId(CIRCLE_VIEWER),
    getProfileId(CIRCLE_APPLICANT),
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

  // ── (k)'s fixture, built from nothing ────────────────────────────────────
  // (k) asserts an ABSOLUTE 1, so it can borrow nothing: not a seeded
  // connection, and not a project other people have applied to.
  //
  // Borrowing a seeded connection is specifically unsafe. connections.test.ts
  // deletes every connection among actor-1, director-1, producer-1 and
  // director-2 in BOTH its beforeAll and its afterAll, and Vitest runs test
  // files in parallel — so any seeded edge between those four can vanish
  // mid-run. composer-1 and cinematographer-1 are outside that set, and its
  // cleanup filters requester_id AND addressee_id to it, so a row with an
  // endpoint outside is never matched. The seed wires no edge between this
  // pair either, so the connection below is ours alone in both directions.
  // (composer-1 and cinematographer-1 own seeded projects and applications
  // elsewhere, which no other file mutates and which this fixture ignores.)
  //
  // The project is get-or-created by title, so ONE stable row is reused rather
  // than one being abandoned per run, and it is left CLOSED afterwards.
  //
  // The sweep runs first, and its result is ASSERTED rather than trusted. That
  // assertion is the load-bearing part: while this project is open it is
  // visible to every approved pro on the live /projects browse screen, and it
  // leaked there once already because the old teardown issued a DELETE against
  // a table with no DELETE policy — which under RLS matches no rows and
  // reports SUCCESS. Nothing failed; the row simply stayed. So the invariant
  // is checked directly: after the sweep, no OPEN fixture project exists. A
  // close that silently does nothing fails here, loudly, instead of putting a
  // "[TEST]" card in front of every pro again.
  await clearCircleFixture();
  const { data: openResidue, error: openResidueErr } = await viewer
    .from("projects")
    .select("id")
    .eq("created_by", viewerId)
    .eq("title", CIRCLE_PROJECT)
    .eq("status", "open");
  expect(openResidueErr).toBeNull();
  expect(openResidue ?? []).toHaveLength(0);

  const existingProjectId = await findCircleProject();
  if (existingProjectId) {
    circleProjectId = existingProjectId;
    // Reopen the stable row: the applications INSERT policy requires
    // status = 'open'. Asserted for the same reason as the sweep above.
    const { data: reopened, error: reopenErr } = await viewer
      .from("projects")
      .update({ status: "open" })
      .eq("id", circleProjectId)
      .select("status");
    expect(reopenErr).toBeNull();
    expect(reopened ?? []).toHaveLength(1);
    expect(reopened![0].status).toBe("open");
  } else {
    const { data: createdProject, error: createErr } = await viewer
      .from("projects")
      .insert({
        created_by: viewerId,
        title: CIRCLE_PROJECT,
        // projects_disciplines_check (multi-discipline.sql) requires a
        // NON-EMPTY array drawn from its vocabulary, so the column default of
        // {} is not insertable. 'any' stands alone, and the legacy single
        // column keeps being written as disciplines[0] — same as createProject.
        disciplines: ["any"],
        discipline: "any",
        // Set outright rather than left to the 'other' default: this project
        // exists to exercise the Phase 4a columns.
        project_type: "short_film",
        description: "[TEST] circle-applied count fixture",
        location: "[TEST]",
        // status omitted — the column default keeps it 'open', which the
        // applications INSERT policy requires.
      })
      .select("id")
      .single();
    expect(createErr).toBeNull();
    circleProjectId = createdProject!.id as string;
  }

  const { data: circleRoles, error: circleRoleErr } = await viewer
    .from("project_roles")
    .insert([
      { project_id: circleProjectId, name: "[TEST] Circle Role One", sort_order: 0 },
      { project_id: circleProjectId, name: "[TEST] Circle Role Two", sort_order: 1 },
    ])
    .select("id");
  expect(circleRoleErr).toBeNull();
  expect(circleRoles ?? []).toHaveLength(2);

  // Request as the viewer, accept as the applicant — the only order the
  // policies allow, since a requester can never accept their own request.
  const { error: requestErr } = await viewer
    .from("connections")
    .insert({ requester_id: viewerId, addressee_id: circleApplicantId });
  expect(requestErr).toBeNull();
  const { data: acceptedRows, error: acceptErr } = await circleApplicant
    .from("connections")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("requester_id", viewerId)
    .eq("addressee_id", circleApplicantId)
    .select("status");
  expect(acceptErr).toBeNull();
  expect(acceptedRows ?? []).toHaveLength(1);

  // ONE applicant, TWO applications — one per role, which the partial unique
  // indexes deliberately allow. This is the shape count(*) got wrong.
  const { error: applyErr } = await circleApplicant.from("applications").insert(
    (circleRoles ?? []).map((r: { id: string }) => ({
      project_id: circleProjectId,
      applicant_id: circleApplicantId,
      role_id: r.id,
      note: "[TEST] circle count",
    }))
  );
  expect(applyErr).toBeNull();
});

afterAll(async () => {
  await clearTestRoles();
  await clearCircleFixture();
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

describe("circle-applied counts", () => {
  // (k) The DISTINCT regression (supabase/projects-saved.sql §2). The fixture
  // is one applicant holding TWO applications on one project — one per role —
  // and one accepted connection to the viewer. "N in your circle applied"
  // counts PEOPLE, so the answer is 1; the old count(*) counted rows and said
  // 2. Nothing else has applied to this project, so 1 is asserted outright.
  test("k) circle_applied_count counts applicants, not applications", async () => {
    const { data: applications, error: applicationsErr } = await circleApplicant
      .from("applications")
      .select("id")
      .eq("project_id", circleProjectId)
      .eq("applicant_id", circleApplicantId);
    expect(applicationsErr).toBeNull();
    expect(applications ?? []).toHaveLength(2);

    const { data: single, error: singleErr } = await viewer.rpc(
      "circle_applied_count",
      { p_project_id: circleProjectId }
    );
    expect(singleErr).toBeNull();
    expect(Number(single)).toBe(1);

    // The batched version must agree with the singular one for the same
    // project — the browse card and the detail page show the same number.
    const { data: batched, error: batchedErr } = await viewer.rpc(
      "circle_applied_counts",
      { p_project_ids: [circleProjectId] }
    );
    expect(batchedErr).toBeNull();
    expect(batched ?? []).toHaveLength(1);
    const row = (batched as { project_id: string; applied_count: number }[])[0];
    expect(row.project_id).toBe(circleProjectId);
    expect(Number(row.applied_count)).toBe(1);
  });
});
