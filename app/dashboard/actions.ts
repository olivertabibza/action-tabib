"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { statusUpdateSchema, type StatusUpdateValues } from "./schema";

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
