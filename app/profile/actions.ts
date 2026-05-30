"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { profileSchema, type ProfileFormValues } from "./schema";

/**
 * Server Action that saves the editable profile fields back to the signed-in
 * user's row. Runs only on the server, so the browser can never write to a
 * different user's profile: we re-read the session and validate the input here.
 */
export async function updateProfile(values: ProfileFormValues) {
  const parsed = profileSchema.safeParse(values);
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

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      headline: parsed.data.headline,
      bio: parsed.data.bio,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  // Refresh any server-rendered views that show these fields.
  revalidatePath("/profile");
  revalidatePath("/home");

  return { success: true };
}
