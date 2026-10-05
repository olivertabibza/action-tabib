import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ADMIN_KEY,
  ADMIN_PASSWORD,
  getProfileId,
  signInAs,
} from "../helpers/auth";

/**
 * Auto-approve switches — only an admin can read or flip them, a switch only
 * affects NEW rows of its own kind, and it never lets an author publish an
 * existing row. Asserted at the DB level against supabase/platform-settings.sql
 * and the guard triggers in supabase/status-guards.sql.
 *
 * FIXTURES: one pending "[TEST] Auto Approve Class" owned by PRO, get-or-created
 * by title and reused across runs (classes have no DELETE policy). Rows the
 * INSERT tests create are moved to 'rejected' in afterAll, so nothing piles up
 * in /admin/content and nothing stays published on /classes or /explore.
 *
 * ADMIN: seed-admin-1 signs in with SEED_ADMIN_PASSWORD. Without it, every test
 * that needs a switch flipped skips visibly — and so do the INSERT tests, whose
 * rows only an admin can move out of the review queue.
 *
 * SAFETY / CLEANUP: afterAll turns every switch OFF, restores the fixture and
 * rejects every inserted row — UPDATEs only, never DELETE — then VERIFIES the
 * result. It runs even when assertions fail.
 */

const PRO = "cinematographer-1"; // approved pro; owns the fixture and inserts
const OTHER = "editor-1"; // approved pro, not the fixture's owner
const HAS_ADMIN = !!ADMIN_PASSWORD;
const NO_ADMIN = "skipped: SEED_ADMIN_PASSWORD is unset";

const SWITCHES = [
  "auto_approve_pro_applications",
  "auto_approve_classes",
  "auto_approve_events",
  "auto_approve_articles",
] as const;
type Switch = (typeof SWITCHES)[number];
const ALL_OFF = Object.fromEntries(SWITCHES.map((s) => [s, false])) as Record<Switch, boolean>;

const FIXTURE_TITLE = "[TEST] Auto Approve Class";
const INSERT_TITLE = "[TEST] Auto Approve Insert";

type Kind = "classes" | "events";

function rowFor(kind: Kind, createdBy: string, title: string): Record<string, unknown> {
  const startsAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
  if (kind === "classes") {
    return {
      created_by: createdBy,
      title,
      description: "[TEST] auto-approve fixture",
      discipline: "actor",
      format: "in_person",
      level: "all",
      venue: "[TEST]",
      price_cents: 0,
      capacity: 5,
      starts_at: startsAt,
    };
  }
  return {
    created_by: createdBy,
    title,
    description: "[TEST] auto-approve fixture",
    venue: "[TEST]",
    event_type: "screening",
    starts_at: startsAt,
  };
}

let pro: SupabaseClient, other: SupabaseClient;
let admin: SupabaseClient | undefined;
let proId: string;
let fixtureId: string;
const insertedIds: Record<Kind, string[]> = { classes: [], events: [] };

async function setSwitches(values: Partial<Record<Switch, boolean>>) {
  const { error } = await admin!.from("platform_settings").update(values).eq("id", true);
  expect(error).toBeNull();
}

async function readSettings(client: SupabaseClient) {
  return client.from("platform_settings").select(SWITCHES.join(", ")).maybeSingle();
}

/** The fixture's status/title as its owner sees it (owners read their own rows). */
async function readFixture() {
  const { data, error } = await pro
    .from("classes")
    .select("status, title")
    .eq("id", fixtureId)
    .single();
  expect(error).toBeNull();
  return data!;
}

/** PRO inserts a fresh row; returns the status it landed with. */
async function insertAs(kind: Kind): Promise<string> {
  const { data, error } = await pro
    .from(kind)
    .insert(rowFor(kind, proId, INSERT_TITLE))
    .select("id, status")
    .single();
  expect(error).toBeNull();
  insertedIds[kind].push(data!.id as string);
  return data!.status as string;
}

beforeAll(async () => {
  [pro, other] = await Promise.all([signInAs(PRO), signInAs(OTHER)]);
  proId = await getProfileId(PRO);
  if (HAS_ADMIN) {
    admin = await signInAs(ADMIN_KEY);
    // Start from a known state, so a get-or-create below can't auto-publish.
    await setSwitches(ALL_OFF);
  } else {
    console.warn(`[platform-settings] Admin and INSERT tests ${NO_ADMIN}.`);
  }

  const { data: existing } = await pro
    .from("classes")
    .select("id")
    .eq("created_by", proId)
    .eq("title", FIXTURE_TITLE)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (existing) {
    fixtureId = existing.id as string;
  } else {
    const { data, error } = await pro
      .from("classes")
      .insert(rowFor("classes", proId, FIXTURE_TITLE))
      .select("id, status")
      .single();
    expect(error).toBeNull();
    expect(data!.status).toBe("pending");
    fixtureId = data!.id as string;
  }
});

afterAll(async () => {
  if (!admin) return; // nothing a non-admin run can have changed needs an admin to undo

  await admin.from("platform_settings").update(ALL_OFF).eq("id", true);
  await admin
    .from("classes")
    .update({ status: "pending", title: FIXTURE_TITLE })
    .eq("id", fixtureId);
  for (const kind of ["classes", "events"] as const) {
    for (const id of insertedIds[kind]) {
      await admin.from(kind).update({ status: "rejected" }).eq("id", id);
    }
  }

  // Verify — cleanup must be proven, not trusted.
  const leftovers: string[] = [];
  const { data: settings } = await readSettings(admin);
  for (const s of SWITCHES) {
    if ((settings as Record<string, boolean> | null)?.[s] !== false)
      leftovers.push(`${s} is not off`);
  }
  const fx = await readFixture();
  if (fx.status !== "pending" || fx.title !== FIXTURE_TITLE)
    leftovers.push(`fixture ${fixtureId} is '${fx.status}' / "${fx.title}"`);
  for (const kind of ["classes", "events"] as const) {
    for (const id of insertedIds[kind]) {
      const { data } = await admin.from(kind).select("status").eq("id", id).single();
      if (data?.status !== "rejected")
        leftovers.push(`${kind} ${id} is '${data?.status}', not 'rejected'`);
    }
  }
  if (leftovers.length > 0) {
    throw new Error(
      `platform-settings teardown left data changed:\n  ${leftovers.join("\n  ")}\n` +
        `Fix by hand as an admin on /admin/settings and /admin/content.`
    );
  }
});

describe("auto-approve switches", () => {
  // (1) RLS: only admins have SELECT and UPDATE policies on platform_settings.
  test("1) a non-admin cannot read or update platform_settings", async () => {
    // No error: the table exists and RLS simply hides the row from a non-admin.
    const { data: read, error: readError } = await readSettings(pro);
    expect(readError).toBeNull();
    expect(read).toBeNull();

    const { data: updated, error: updateError } = await pro
      .from("platform_settings")
      .update({ auto_approve_classes: true })
      .eq("id", true)
      .select("id");
    expect(updateError).toBeNull();
    expect(updated ?? []).toEqual([]);

    if (admin) {
      const { data } = await readSettings(admin);
      expect((data as Record<string, boolean> | null)?.auto_approve_classes).toBe(false);
    }
  });

  describe.skipIf(!HAS_ADMIN)(`with an admin${HAS_ADMIN ? "" : ` (${NO_ADMIN})`}`, () => {
    // (2) The switch decides where a new class lands.
    test("2) classes switch off → new class 'pending'; on → 'published'", async () => {
      await setSwitches({ auto_approve_classes: false });
      expect(await insertAs("classes")).toBe("pending");

      await setSwitches({ auto_approve_classes: true });
      expect(await insertAs("classes")).toBe("published");
    });

    // (3) Each table reads its own switch.
    test("3) classes on, events off → new event still 'pending'", async () => {
      await setSwitches({ auto_approve_classes: true, auto_approve_events: false });
      expect(await insertAs("events")).toBe("pending");
    });

    // (4) Auto-approve is INSERT-only; the UPDATE branch still restores status.
    test("4) with the switch on, a pro cannot publish its own pending class", async () => {
      await setSwitches({ auto_approve_classes: true });
      await pro.from("classes").update({ status: "published" }).eq("id", fixtureId);
      expect((await readFixture()).status).toBe("pending");
    });
  });

  // (5) "Authors update own classes" is scoped to created_by = auth.uid().
  test("5) a non-admin cannot update another user's pending class", async () => {
    const { data } = await other
      .from("classes")
      .update({ status: "published", title: `${FIXTURE_TITLE} (hijacked)` })
      .eq("id", fixtureId)
      .select("id");
    expect(data ?? []).toEqual([]);
    expect(await readFixture()).toEqual({ status: "pending", title: FIXTURE_TITLE });
  });
});
