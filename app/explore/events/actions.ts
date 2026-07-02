"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Toggle the caller's RSVP for an event. Logged-out visitors are sent to
 * /login. Otherwise we delete an existing RSVP or insert a new one, then
 * revalidate the event detail page and the Fan Events tab so both reflect the
 * new state and attendee count. RLS also enforces user_id = auth.uid() and that
 * the event is published, so this never trusts the client.
 */
export async function toggleRsvp(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existing } = await supabase
    .from("event_rsvps")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("event_rsvps")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("event_rsvps")
      .insert({ event_id: eventId, user_id: user.id });
    // A racing double-insert collides on the unique constraint; treat as success.
    if (error && error.code !== "23505") return { error: error.message };
  }

  revalidatePath(`/explore/events/${eventId}`);
  revalidatePath("/fan/events");
  return { success: true };
}
