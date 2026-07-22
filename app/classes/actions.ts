"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { classSchema, reviewSchema, type ClassFormValues } from "./schema";

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

/**
 * Submit (or edit) the caller's review of a class. The upsert targets the
 * unique (class_id, reviewer_id) pair, so submitting again updates your
 * existing review instead of failing. RLS is the enforcement layer: only an
 * enrolled, approved pro can insert, and only the reviewer can hit the
 * conflict-update path — so a denial here means "you're not enrolled".
 */
export async function submitReview(
  classId: string,
  rating: number,
  body: string
) {
  const parsed = reviewSchema.safeParse({ rating, body });
  if (!parsed.success) {
    return { error: "Please check your review and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." };
  }

  const { error } = await supabase.from("class_reviews").upsert(
    {
      class_id: classId,
      reviewer_id: user.id,
      rating: parsed.data.rating,
      body: parsed.data.body,
    },
    { onConflict: "class_id,reviewer_id" }
  );

  if (error) {
    return { error: "Only people enrolled in this class can review it." };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath("/classes");
  return { success: true };
}

/** Delete the caller's own review of a class. RLS restricts the delete to
 *  rows where reviewer_id = auth.uid(); the filter is the in-app echo. */
export async function deleteReview(classId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." };
  }

  const { error } = await supabase
    .from("class_reviews")
    .delete()
    .eq("class_id", classId)
    .eq("reviewer_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/classes/${classId}`);
  revalidatePath("/classes");
  return { success: true };
}
