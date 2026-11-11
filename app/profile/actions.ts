"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { MAX_PORTFOLIO_FILES } from "@/lib/portfolio";
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

/** The signed-in member's current portfolio paths. */
async function currentPortfolio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("portfolio_files")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data.portfolio_files as string[] | null) ?? [];
}

/**
 * Add files the browser has just uploaded to the "portfolios" bucket. The
 * database only accepts paths in the member's own folder, at most 10
 * (profiles_portfolio_files_check, supabase/portfolios.sql). On an error the
 * caller deletes the uploads, since nothing points at them.
 */
export async function addPortfolioFiles(paths: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." };
  }
  if (paths.length === 0 || !paths.every((p) => p.startsWith(`${user.id}/`))) {
    return { error: "Those files couldn't be added. Try again." };
  }

  const current = await currentPortfolio(supabase, user.id);
  if (current === null) {
    return { error: "Those files couldn't be added. Try again." };
  }
  if (current.length + paths.length > MAX_PORTFOLIO_FILES) {
    return {
      error: `A portfolio holds up to ${MAX_PORTFOLIO_FILES} files. Remove some first.`,
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ portfolio_files: [...current, ...paths] })
    .eq("id", user.id);
  if (error) {
    return { error: "Those files couldn't be added. Try again." };
  }

  revalidatePath("/profile");
  return { success: true };
}

/**
 * Remove one portfolio file: take it off the profile first, then delete the
 * stored object, so the profile never lists a file that's gone. A leftover
 * object is harmless; storage deletes need the owner-read rule in
 * supabase/portfolios.sql, which covers your own folder.
 */
export async function removePortfolioFile(path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." };
  }

  const current = await currentPortfolio(supabase, user.id);
  if (current === null || !current.includes(path)) {
    return { error: "That file couldn't be removed. Try again." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ portfolio_files: current.filter((p) => p !== path) })
    .eq("id", user.id);
  if (error) {
    return { error: "That file couldn't be removed. Try again." };
  }

  await supabase.storage.from("portfolios").remove([path]);

  revalidatePath("/profile");
  return { success: true };
}
