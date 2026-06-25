"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Re-read the session and confirm the caller is an approved professional.
 * RLS enforces this too, but we re-check server-side so the actions fail with a
 * friendly message rather than a raw policy error, and never trust the client.
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
    return {
      error: "Only approved professionals can do this." as const,
    };
  }

  return { user };
}

/**
 * Follow another creator. Inserts the follow edge (RLS also requires
 * follower_id = auth.uid() and an approved pro), then records a
 * 'started_following' activity event so it shows up in feeds. The followed
 * person's name is denormalized into metadata so the feed renders without a join
 * (subject_id is not a foreign key — see supabase/social-feed.sql).
 */
export async function followCreator(targetId: string) {
  const supabase = await createClient();
  const auth = await requireApprovedPro(supabase);
  if ("error" in auth) return auth;

  if (targetId === auth.user.id) {
    return { error: "You can't follow yourself." };
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: auth.user.id, following_id: targetId });

  if (error) {
    // Already following — treat as success so the toggle is idempotent. Don't
    // record a second activity event.
    if (error.code === "23505") {
      revalidatePath("/network");
      revalidatePath("/dashboard");
      return { success: true };
    }
    return { error: error.message };
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", targetId)
    .maybeSingle();

  await supabase.from("activity_events").insert({
    actor_id: auth.user.id,
    kind: "started_following",
    subject_id: targetId,
    metadata: { target_name: target?.display_name ?? null },
  });

  revalidatePath("/network");
  revalidatePath("/dashboard");
  return { success: true };
}

/** Unfollow a creator. RLS limits the delete to your own follow edge; we pass
 *  follower_id in the filter as a second line of defence. */
export async function unfollowCreator(targetId: string) {
  const supabase = await createClient();
  const auth = await requireApprovedPro(supabase);
  if ("error" in auth) return auth;

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", auth.user.id)
    .eq("following_id", targetId);

  if (error) return { error: error.message };

  revalidatePath("/network");
  revalidatePath("/dashboard");
  return { success: true };
}
