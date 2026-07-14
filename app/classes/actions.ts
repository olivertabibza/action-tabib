"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { classSchema, type ClassFormValues } from "./schema";

/**
 * Teach a class. Inserts a row owned by the signed-in user; RLS also requires an
 * approved professional and forces the default 'pending' status, so this can't
 * self-publish. The date + time inputs are combined into `starts_at` (exactly as
 * createEvent does), and the dollar price is converted to `price_cents`. On
 * success we redirect back to /classes with a flag the tab turns into the same
 * "pending review" banner Explore shows.
 */
export async function createClass(values: ClassFormValues) {
  const parsed = classSchema.safeParse(values);
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

  const { date, time, price, ...rest } = parsed.data;
  const starts = new Date(`${date}T${time}`);
  if (Number.isNaN(starts.getTime())) {
    return { error: "That date and time don't look right." };
  }

  const { error } = await supabase.from("classes").insert({
    created_by: user.id,
    ...rest,
    price_cents: Math.round(price * 100),
    starts_at: starts.toISOString(),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/classes");
  redirect("/classes?submitted=class");
}

/**
 * Toggle the caller's enrollment in a class. Logged-out visitors are sent to
 * /login. Otherwise we delete an existing enrollment or insert a new one, then
 * revalidate the detail page and the Classes tab. RLS enforces user_id =
 * auth.uid(), approved-pro, published-class, AND the capacity cap — so if the
 * class filled up between render and click, the insert is rejected and we
 * surface a friendly message instead of crashing. Mirrors toggleRsvp.
 */
export async function toggleEnrollment(classId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existing } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("class_id", classId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("class_enrollments")
      .delete()
      .eq("class_id", classId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("class_enrollments")
      .insert({ class_id: classId, user_id: user.id });
    if (error) {
      // A racing double-insert collides on the unique constraint; treat as
      // success. Any other insert denial for an approved pro on a published
      // class is the capacity cap in the RLS policy — the class is full.
      if (error.code === "23505") {
        // fall through to success
      } else {
        return { error: "This class is full." };
      }
    }
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath("/classes");
  return { success: true };
}
