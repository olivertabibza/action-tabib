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
      role: parsed.data.role,
      headline: parsed.data.headline,
      bio: parsed.data.bio,
      skills: parsed.data.skills,
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

const AVATAR_FILE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/**
 * Point the signed-in member's profile at a new photo, or remove it (null).
 * The browser uploads the file first (supabase/avatars.sql lets members write
 * only to their own folder); this saves the path and deletes the previous
 * file so old photos don't pile up (ENG F13). Fans use it too.
 */
export async function setAvatarPath(path: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." };
  }
  const ownFile =
    path !== null && AVATAR_FILE.test(path) && path.startsWith(`${user.id}/`);
  if (path !== null && !ownFile) {
    return { error: "That photo couldn't be saved. Try again." };
  }

  const { data: before } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", user.id);
  if (error) {
    return { error: "That photo couldn't be saved. Try again." };
  }

  const old = before?.avatar_path as string | null | undefined;
  if (old && old !== path) {
    // Best effort: a leftover file is harmless, a failed save isn't.
    await supabase.storage.from("avatars").remove([old]);
  }

  // The photo shows in the header and on lists across the app.
  revalidatePath("/", "layout");
  return { success: true };
}
