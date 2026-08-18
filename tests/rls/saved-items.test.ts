import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { signInAs, getProfileId } from "../helpers/auth";

/**
 * Saved items (bookmarks) RLS — asserted at the DB level against
 * supabase/saved-items.sql. Saves are private per user: you save only as
 * yourself, only PUBLISHED events/articles, and only ever see your own rows.
 *
 * Projects are saveable too since Phase 4b: supabase/projects-saved.sql adds a
 * third arm to the INSERT policy, gated on can_view_project() rather than mere
 * existence — so the visibility rule, not just the item_type check, is what a
 * project save has to clear.
 *
 * FIXTURES: scripts/seed.ts already seeds PUBLISHED events and articles and an
 * OPEN project, so we reuse one of each by title. The unpublished case needs a
 * PENDING event, which no seed row provides — so it's get-or-created here as
 * producer-1 (status defaults to 'pending'), same pattern as the hidden class
 * in classes.test.ts. director-2 is a seeded PENDING pro, so is_approved_pro()
 * — and therefore can_view_project() on an open project — is false for them.
 *
 * SAFETY / CLEANUP: acts only as seed accounts. saved_items ARE deletable by
 * their owner, so each user clears every save they created. `events` rows are
 * append-only under RLS (no DELETE policy): the pending "[TEST]" event is
 * reused across runs — bounded, tagged, seed-only residue (and wiped anyway by
 * the next `npm run seed`, which deletes seed-owned events).
 */

const EVENT_TITLE = "Indie Shorts Night + Q&A"; // seeded, published
const ARTICLE_TITLE = "How a microbudget short found its festival run"; // seeded, published
const HIDDEN_TITLE = "[TEST] Hidden Saved Fixture";
const PROJECT_TITLE = "Last Train to Lisbon"; // seeded, open

const SAVER = "actor-1"; // approved pro; saves the fixtures (user A)
const OTHER = "writer-1"; // the user who must NOT reach A's saves (user B)
const PENDING_AUTHOR = "producer-1"; // approved pro → may create the pending event
const PENDING = "director-2"; // seed PENDING pro → is_approved_pro() false

let saver: SupabaseClient, other: SupabaseClient, author: SupabaseClient;
let pending: SupabaseClient;
let saverId: string, otherId: string, authorId: string, pendingId: string;

let eventId: string;
let articleId: string;
let hiddenEventId: string;
let projectId: string;

/** Each user clears its own saves (idempotency after a crashed run + cleanup). */
async function clearSaves() {
  await Promise.all([
    saver.from("saved_items").delete().eq("user_id", saverId),
    other.from("saved_items").delete().eq("user_id", otherId),
    // Nothing should ever land here — but if the project arm regresses, this
    // stops the residue from poisoning the next run.
    pending.from("saved_items").delete().eq("user_id", pendingId),
  ]);
}

beforeAll(async () => {
  [saver, other, author, pending] = await Promise.all([
    signInAs(SAVER),
    signInAs(OTHER),
    signInAs(PENDING_AUTHOR),
    signInAs(PENDING),
  ]);
  [saverId, otherId, authorId, pendingId] = await Promise.all([
    getProfileId(SAVER),
    getProfileId(OTHER),
    getProfileId(PENDING_AUTHOR),
    getProfileId(PENDING),
  ]);

  // The seeded published fixtures (readable by anyone because they're published).
  const [{ data: event }, { data: article }] = await Promise.all([
    saver
      .from("events")
      .select("id")
      .eq("title", EVENT_TITLE)
      .eq("status", "published")
      .maybeSingle(),
    saver
      .from("articles")
      .select("id")
      .eq("title", ARTICLE_TITLE)
      .eq("status", "published")
      .maybeSingle(),
  ]);
  if (!event || !article) {
    throw new Error(
      `Missing published seed fixtures ("${EVENT_TITLE}" / "${ARTICLE_TITLE}"). ` +
        `Run \`npm run seed\` — it seeds both.`
    );
  }
  eventId = event.id as string;
  articleId = article.id as string;

  // The seeded OPEN project. Read as the saver (an approved pro), who is the
  // audience "Approved members read open projects" — and can_view_project() —
  // grant it to.
  const { data: project } = await saver
    .from("projects")
    .select("id")
    .eq("title", PROJECT_TITLE)
    .eq("status", "open")
    .maybeSingle();
  if (!project) {
    throw new Error(
      `Missing open seed project "${PROJECT_TITLE}". Run \`npm run seed\`.`
    );
  }
  projectId = project.id as string;

  // Get-or-create the pending [TEST] event (append-only, so reuse across runs).
  const { data: existingHidden } = await author
    .from("events")
    .select("id")
    .eq("created_by", authorId)
    .eq("title", HIDDEN_TITLE)
    .eq("status", "pending")
    .maybeSingle();
  if (existingHidden) {
    hiddenEventId = existingHidden.id as string;
  } else {
    const { data, error } = await author
      .from("events")
      .insert({
        created_by: authorId,
        title: HIDDEN_TITLE,
        description: "[TEST] not saveable — never published",
        venue: "[TEST]",
        event_type: "screening",
        starts_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        // status intentionally omitted — the column default keeps it 'pending'.
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    hiddenEventId = data!.id as string;
  }

  await clearSaves();
});

afterAll(async () => {
  await clearSaves();
});

describe("saved_items RLS", () => {
  // (a) The happy path: save a published event and article, read back exactly
  // those rows. Asserting the insert errors are null proves the fixtures are
  // valid (published + own user_id), not just that the reads return something.
  test("a) a user saves published items and reads back their own", async () => {
    const { error: evErr } = await saver
      .from("saved_items")
      .insert({ user_id: saverId, item_type: "event", item_id: eventId });
    expect(evErr).toBeNull();
    const { error: artErr } = await saver
      .from("saved_items")
      .insert({ user_id: saverId, item_type: "article", item_id: articleId });
    expect(artErr).toBeNull();

    const { data: mine } = await saver
      .from("saved_items")
      .select("item_type, item_id")
      .eq("user_id", saverId);
    expect(mine?.length ?? 0).toBe(2);
    expect(mine).toEqual(
      expect.arrayContaining([
        { item_type: "event", item_id: eventId },
        { item_type: "article", item_id: articleId },
      ])
    );
  });

  // (b) You cannot save AS someone else (user_id spoofing).
  test("b) saving as another user is rejected", async () => {
    const { error } = await other.from("saved_items").insert({
      user_id: saverId, // NOT the caller — with check requires ==auth.uid()
      item_type: "event",
      item_id: eventId,
    });
    expect(error).not.toBeNull();
  });

  // (c) You cannot save an unpublished item — the published EXISTS in the
  // insert policy fails for the pending event (invisible to a non-author).
  test("c) saving a pending item is rejected", async () => {
    const { error } = await other.from("saved_items").insert({
      user_id: otherId,
      item_type: "event",
      item_id: hiddenEventId,
    });
    expect(error).not.toBeNull();
  });

  // (d) Another user's saves are invisible — RLS filters silently (0 rows, not
  // an error).
  test("d) another user's saves are invisible", async () => {
    const { data, error } = await other
      .from("saved_items")
      .select("id")
      .eq("user_id", saverId);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  // (e) Deleting someone else's save is a silent no-op; deleting your own works.
  test("e) delete is owner-only", async () => {
    // B "deletes" A's event save — matches no deletable row, no error raised.
    const { error: delErr } = await other
      .from("saved_items")
      .delete()
      .eq("user_id", saverId)
      .eq("item_id", eventId);
    expect(delErr).toBeNull();

    // A can still read it…
    const { data: still } = await saver
      .from("saved_items")
      .select("id")
      .eq("user_id", saverId)
      .eq("item_id", eventId);
    expect(still?.length ?? 0).toBe(1);

    // …and A's own delete actually removes it.
    const { error: ownDelErr } = await saver
      .from("saved_items")
      .delete()
      .eq("user_id", saverId)
      .eq("item_id", eventId);
    expect(ownDelErr).toBeNull();
    const { data: after } = await saver
      .from("saved_items")
      .select("id")
      .eq("user_id", saverId)
      .eq("item_id", eventId);
    expect(after?.length ?? 0).toBe(0);
  });

  // (f) Phase 4b: an approved pro saves an OPEN project. The third arm of the
  // insert policy calls can_view_project(), which is true for them — this is
  // the case the arm exists for, and it fails outright without it (the policy
  // had no else branch, so a project save was rejected whatever item_type
  // allowed).
  test("f) an approved pro saves an open project", async () => {
    const { error } = await saver
      .from("saved_items")
      .insert({ user_id: saverId, item_type: "project", item_id: projectId });
    expect(error).toBeNull();

    const { data: mine } = await saver
      .from("saved_items")
      .select("item_id")
      .eq("user_id", saverId)
      .eq("item_type", "project");
    expect(mine).toEqual([{ item_id: projectId }]);
  });

  // (g) …and a PENDING pro cannot save that same project. is_approved_pro() is
  // false for them, so can_view_project() is false, so the arm rejects it —
  // which is why the arm gates on visibility rather than on the project merely
  // existing. Bookmarking is not a way to hold on to something you can't read.
  test("g) a pending pro cannot save that same project", async () => {
    const { error } = await pending
      .from("saved_items")
      .insert({ user_id: pendingId, item_type: "project", item_id: projectId });
    expect(error).not.toBeNull();

    const { data: theirs } = await pending
      .from("saved_items")
      .select("id")
      .eq("user_id", pendingId);
    expect(theirs?.length ?? 0).toBe(0);
  });

  // (h) A project save is as private as any other: B sees none of A's, whether
  // they filter by A's user_id or just ask for every project save they can
  // read. Same silent 0-row filtering as (d), asserted for the new item_type.
  test("h) a saved project appears in the caller's own reads only", async () => {
    const { data: byOwner, error: byOwnerErr } = await other
      .from("saved_items")
      .select("id")
      .eq("user_id", saverId)
      .eq("item_type", "project");
    expect(byOwnerErr).toBeNull();
    expect(byOwner?.length ?? 0).toBe(0);

    const { data: allVisible, error: allErr } = await other
      .from("saved_items")
      .select("id")
      .eq("item_type", "project");
    expect(allErr).toBeNull();
    expect(allVisible?.length ?? 0).toBe(0);
  });
});
