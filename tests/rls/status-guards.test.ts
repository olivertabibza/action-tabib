import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ADMIN_KEY,
  ADMIN_PASSWORD,
  getProfileId,
  signInAs,
} from "../helpers/auth";

/**
 * Status & privilege guards — a non-admin can never grant itself is_admin or an
 * approved application, and can never publish its own class, event or article.
 * Asserted at the DB level against supabase/status-guards.sql.
 *
 * FIXTURES: seed-pending-1 is a seeded PENDING pro reserved for this file. The
 * UPDATE tests use one pending "[TEST] Status Guard …" class, event and article
 * owned by PRO, get-or-created by title (these tables have no DELETE policy, so
 * rows are reused across runs rather than abandoned per run — same pattern as
 * classes.test.ts).
 *
 * ADMIN: seed-admin-1 signs in with SEED_ADMIN_PASSWORD. Without it, the admin
 * tests skip visibly — and so does the INSERT test (3): once the guard is live
 * its rows land 'pending', no DELETE policy exists, and only an admin can move
 * them out of the review queue, so running it without an admin would pile a
 * class, an event and an article into /admin/content on every run.
 *
 * SAFETY / CLEANUP: afterAll puts back every is_admin, application_status and
 * status value these tests may have changed — UPDATEs only, never DELETE — and
 * then VERIFIES the result, failing loudly if anything is left elevated or
 * published. It runs even when assertions fail. Each restore is tried as the
 * row's owner (which works while the hole is open) and as the admin (which works
 * once the guard is live).
 */

const PRO = "cinematographer-1"; // approved pro; the escalation/authoring caller
const PENDING = "pending-1"; // seed PENDING pro reserved for this file
const HAS_ADMIN = !!ADMIN_PASSWORD;
const NO_ADMIN = "skipped: SEED_ADMIN_PASSWORD is unset";

const KINDS = ["classes", "events", "articles"] as const;
type Kind = (typeof KINDS)[number];

const FIXTURE_TITLE: Record<Kind, string> = {
  classes: "[TEST] Status Guard Class",
  events: "[TEST] Status Guard Event",
  articles: "[TEST] Status Guard Article",
};
const INSERT_TITLE: Record<Kind, string> = {
  classes: "[TEST] Status Guard Insert Class",
  events: "[TEST] Status Guard Insert Event",
  articles: "[TEST] Status Guard Insert Article",
};

/** The minimum valid row for each table, owned by `createdBy`. */
function rowFor(
  kind: Kind,
  createdBy: string,
  title: string
): Record<string, unknown> {
  const startsAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
  if (kind === "classes") {
    return {
      created_by: createdBy,
      title,
      description: "[TEST] status guard fixture",
      discipline: "actor",
      format: "in_person",
      level: "all",
      venue: "[TEST]",
      price_cents: 0,
      capacity: 5,
      starts_at: startsAt,
    };
  }
  if (kind === "events") {
    return {
      created_by: createdBy,
      title,
      description: "[TEST] status guard fixture",
      venue: "[TEST]",
      event_type: "screening",
      starts_at: startsAt,
    };
  }
  return {
    created_by: createdBy,
    title,
    category: "craft",
    excerpt: "[TEST] status guard fixture",
    body: "[TEST] status guard fixture",
  };
}

let pro: SupabaseClient, pending: SupabaseClient;
let admin: SupabaseClient | undefined;
let proId: string, pendingId: string;
let originalDisplayName: string | null;

const fixtureId = {} as Record<Kind, string>;
const insertedIds: Record<Kind, string[]> = { classes: [], events: [], articles: [] };

async function readProfile(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from("profiles")
    .select("is_admin, application_status, display_name")
    .eq("id", id)
    .single();
  expect(error).toBeNull();
  return data!;
}

async function readRow(kind: Kind, id: string) {
  const { data, error } = await (admin ?? pro)
    .from(kind)
    .select("status, title")
    .eq("id", id)
    .single();
  expect(error).toBeNull();
  return data!;
}

/** Try an update as each of `clients` in turn; failures are ignored here and
 *  caught by the verification pass in afterAll. */
async function restore(
  clients: (SupabaseClient | undefined)[],
  table: string,
  values: Record<string, unknown>,
  id: string
) {
  for (const client of clients) {
    if (client) await client.from(table).update(values).eq("id", id);
  }
}

beforeAll(async () => {
  [pro, pending] = await Promise.all([signInAs(PRO), signInAs(PENDING)]);
  [proId, pendingId] = await Promise.all([getProfileId(PRO), getProfileId(PENDING)]);
  if (HAS_ADMIN) admin = await signInAs(ADMIN_KEY);
  else console.warn(`[status-guards] Admin tests and test 3 ${NO_ADMIN}.`);

  originalDisplayName = (await readProfile(pro, proId)).display_name;

  // Preconditions: nothing left over from an earlier, interrupted run.
  expect((await readProfile(pro, proId)).is_admin).toBe(false);
  expect((await readProfile(pending, pendingId)).application_status).toBe("pending");

  for (const kind of KINDS) {
    const { data: existing } = await pro
      .from(kind)
      .select("id")
      .eq("created_by", proId)
      .eq("title", FIXTURE_TITLE[kind])
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();
    if (existing) {
      fixtureId[kind] = existing.id as string;
      continue;
    }
    const { data, error } = await pro
      .from(kind)
      .insert(rowFor(kind, proId, FIXTURE_TITLE[kind]))
      .select("id, status")
      .single();
    expect(error).toBeNull();
    expect(data!.status).toBe("pending");
    fixtureId[kind] = data!.id as string;
  }
});

afterAll(async () => {
  const owner = [pro, admin];

  // Put everything back (updates only).
  await restore(owner, "profiles", { is_admin: false }, proId);
  await restore([pending, admin], "profiles", { application_status: "pending" }, pendingId);
  await pro.from("profiles").update({ display_name: originalDisplayName }).eq("id", proId);
  for (const kind of KINDS) {
    await restore(owner, kind, { status: "pending", title: FIXTURE_TITLE[kind] }, fixtureId[kind]);
    // Rows test 3 created: 'rejected' keeps them out of the review queue.
    for (const id of insertedIds[kind]) {
      await restore(owner, kind, { status: "rejected" }, id);
    }
  }

  // Verify — cleanup must be proven, not trusted.
  const leftovers: string[] = [];
  const proRow = await readProfile(pro, proId);
  if (proRow.is_admin) leftovers.push(`${PRO} still has is_admin = true`);
  if (proRow.display_name !== originalDisplayName)
    leftovers.push(`${PRO} display_name not restored`);
  const pendingRow = await readProfile(pending, pendingId);
  if (pendingRow.application_status !== "pending")
    leftovers.push(`${PENDING} is '${pendingRow.application_status}', not 'pending'`);
  for (const kind of KINDS) {
    const fx = await readRow(kind, fixtureId[kind]);
    if (fx.status !== "pending" || fx.title !== FIXTURE_TITLE[kind])
      leftovers.push(`${kind} fixture ${fixtureId[kind]} is '${fx.status}' / "${fx.title}"`);
    for (const id of insertedIds[kind]) {
      const row = await readRow(kind, id);
      if (row.status !== "rejected")
        leftovers.push(`${kind} ${id} (test 3) is '${row.status}', not 'rejected'`);
    }
  }
  if (leftovers.length > 0) {
    throw new Error(
      `status-guards teardown left seed data changed:\n  ${leftovers.join("\n  ")}\n` +
        `Run \`npm run seed\` to reset seed profiles; content rows need an admin.`
    );
  }
});

describe("status & privilege guards", () => {
  // (1) RLS lets a user update its own profile row, and RLS can't restrict
  // columns — so the guard trigger must restore is_admin.
  test("1) a pro cannot make itself an admin", async () => {
    try {
      await pro.from("profiles").update({ is_admin: true }).eq("id", proId);
      expect((await readProfile(pro, proId)).is_admin).toBe(false);
    } finally {
      // Don't leave a seed account elevated while the rest of the file runs.
      await restore([pro, admin], "profiles", { is_admin: false }, proId);
    }
  });

  // (2) Same hole for the approval flag.
  test("2) a pending pro cannot approve its own application", async () => {
    try {
      await pending
        .from("profiles")
        .update({ application_status: "approved" })
        .eq("id", pendingId);
      expect((await readProfile(pending, pendingId)).application_status).toBe("pending");
    } finally {
      await restore([pending, admin], "profiles", { application_status: "pending" }, pendingId);
    }
  });

  // (3) The INSERT policies check ownership and approval, never status.
  test.skipIf(!HAS_ADMIN)(
    `3) a pro's own insert with status 'published' lands 'pending'${HAS_ADMIN ? "" : ` (${NO_ADMIN})`}`,
    async () => {
      const landed = {} as Record<Kind, string>;
      for (const kind of KINDS) {
        const { data, error } = await pro
          .from(kind)
          .insert({ ...rowFor(kind, proId, INSERT_TITLE[kind]), status: "published" })
          .select("id, status")
          .single();
        expect(error).toBeNull();
        insertedIds[kind].push(data!.id as string);
        landed[kind] = data!.status as string;
      }
      expect(landed).toEqual({ classes: "pending", events: "pending", articles: "pending" });
    }
  );

  // (4) "Authors update own …" lets the author write any column on its row.
  test("4) a pro cannot publish its own pending class, event or article", async () => {
    const after = {} as Record<Kind, string>;
    for (const kind of KINDS) {
      await pro.from(kind).update({ status: "published" }).eq("id", fixtureId[kind]);
      after[kind] = (await readRow(kind, fixtureId[kind])).status;
    }
    expect(after).toEqual({ classes: "pending", events: "pending", articles: "pending" });
  });

  // (5) Regressions: the guards pin only privileged columns.
  test("5) a pro can still edit its display_name and its own titles", async () => {
    const edited = `${originalDisplayName ?? "Seed"} (edited)`;
    try {
      const { error } = await pro
        .from("profiles")
        .update({ display_name: edited })
        .eq("id", proId);
      expect(error).toBeNull();
      expect((await readProfile(pro, proId)).display_name).toBe(edited);
    } finally {
      await pro.from("profiles").update({ display_name: originalDisplayName }).eq("id", proId);
    }

    for (const kind of KINDS) {
      const title = `${FIXTURE_TITLE[kind]} (edited)`;
      try {
        const { error } = await pro.from(kind).update({ title }).eq("id", fixtureId[kind]);
        expect(error).toBeNull();
        expect({ kind, title: (await readRow(kind, fixtureId[kind])).title }).toEqual({
          kind,
          title,
        });
      } finally {
        await pro.from(kind).update({ title: FIXTURE_TITLE[kind] }).eq("id", fixtureId[kind]);
      }
    }
  });

  // (6) The guards must not get in an admin's way.
  describe.skipIf(!HAS_ADMIN)(`6) admin${HAS_ADMIN ? "" : ` (${NO_ADMIN})`}`, () => {
    test("approves a pending application", async () => {
      const { error } = await admin!
        .from("profiles")
        .update({ application_status: "approved" })
        .eq("id", pendingId);
      expect(error).toBeNull();
      expect((await readProfile(admin!, pendingId)).application_status).toBe("approved");
    });

    test("publishes a pending class, event and article", async () => {
      for (const kind of KINDS) {
        const { error } = await admin!
          .from(kind)
          .update({ status: "published" })
          .eq("id", fixtureId[kind]);
        expect(error).toBeNull();
        const { status } = await readRow(kind, fixtureId[kind]);
        expect({ kind, status }).toEqual({ kind, status: "published" });
      }
    });
  });
});
