"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { statusUpdateSchema, type StatusUpdateValues } from "./schema";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Re-read the session and confirm the caller is an approved professional, the
 * same check postStatusUpdate does inline (kept inline there so it can keep its
 * own "post updates" wording). RLS enforces this too — this is so the actions
 * fail with a friendly message and never trust the client's idea of who it is.
 */
async function requireApprovedPro(supabase: ServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." as const };
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("account_type, application_status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    me?.account_type !== "professional" ||
    me?.application_status !== "approved"
  ) {
    return { error: "Only approved professionals can do this." as const };
  }

  return { user };
}

/**
 * Post a status update to the feed. RLS enforces actor_id = auth.uid() and an
 * approved pro, but we re-read the session and re-check approval here so the
 * action fails with a friendly message and the client can never spoof the actor.
 */
export async function postStatusUpdate(values: StatusUpdateValues) {
  const parsed = statusUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Please check your update and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." };
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("account_type, application_status")
    .eq("id", user.id)
    .maybeSingle();
  if (
    me?.account_type !== "professional" ||
    me?.application_status !== "approved"
  ) {
    return { error: "Only approved professionals can post updates." };
  }

  const { error } = await supabase.from("activity_events").insert({
    actor_id: user.id,
    kind: "status_update",
    body: parsed.data.body,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * The Congratulate toggle. 'congratulate' is the only value the kind CHECK
 * allows today, so it's written as a literal rather than plumbed through as a
 * parameter. A duplicate insert (23505) means the reaction is already there —
 * idempotent, so treat it as success.
 */
export async function toggleCongratulate(eventId: string, on: boolean) {
  const supabase = await createClient();
  const auth = await requireApprovedPro(supabase);
  if ("error" in auth) return auth;

  if (on) {
    const { error } = await supabase.from("activity_reactions").insert({
      event_id: eventId,
      actor_id: auth.user.id,
      kind: "congratulate",
    });
    if (error && error.code !== "23505") return { error: error.message };
  } else {
    const { error } = await supabase
      .from("activity_reactions")
      .delete()
      .eq("event_id", eventId)
      .eq("actor_id", auth.user.id)
      .eq("kind", "congratulate");
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

