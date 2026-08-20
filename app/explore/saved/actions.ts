"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Toggle the caller's save (bookmark) for an event, article or project.
 * Logged-out visitors are sent to /login. Otherwise we delete an existing save
 * or insert a new one, then revalidate the surfaces that render the new state.
 * RLS also enforces user_id = auth.uid() and that the item is visible (for a
 * project, can_view_project() — supabase/projects-saved.sql §1), so this never
 * trusts the client. Shared by every save affordance, so it lives in one place.
 */
export async function toggleSave(
  itemType: "event" | "article" | "project",
  itemId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existing } = await supabase
    .from("saved_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("saved_items")
      .delete()
      .eq("user_id", user.id)
      .eq("item_type", itemType)
      .eq("item_id", itemId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("saved_items")
      .insert({ user_id: user.id, item_type: itemType, item_id: itemId });
    // A racing double-save collides on the unique constraint; treat as success.
    if (error && error.code !== "23505") return { error: error.message };
  }

  revalidatePath(`/explore/${itemType}s/${itemId}`);
  revalidatePath("/fan/profile");
  // The Callboard browse screen renders a bookmark on every card and a
  // "★ Saved (N)" count in its header, both of which this changes.
  revalidatePath("/projects");
  return { success: true };
}
