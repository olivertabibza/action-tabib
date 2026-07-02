"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { eventSchema, type EventFormValues } from "./schema";

/**
 * Host an event. Inserts a row owned by the signed-in user; RLS also requires an
 * approved professional and forces the default 'pending' status, so this can't
 * self-publish. The date + time inputs are combined into `starts_at`. On success
 * we redirect back to /explore with a flag the tab turns into a "pending review"
 * banner.
 */
export async function createEvent(values: EventFormValues) {
  const parsed = eventSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Please check the form and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." };
  }

  const { date, time, ...rest } = parsed.data;
  const starts = new Date(`${date}T${time}`);
  if (Number.isNaN(starts.getTime())) {
    return { error: "That date and time don't look right." };
  }

  const { error } = await supabase.from("events").insert({
    created_by: user.id,
    ...rest,
    starts_at: starts.toISOString(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/explore");
  redirect("/explore?submitted=event");
}

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
