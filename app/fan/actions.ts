"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Re-read the session and confirm the caller is a "member" allowed to follow:
 * any authenticated consumer, or an approved professional. Mirrors the DB's
 * is_member() helper (see supabase/fan-follows.sql). RLS ("Members follow")
 * enforces this too, but we re-check server-side so the actions fail with a
 * friendly message rather than a raw policy error, and never trust the client.
 */
async function requireMember(supabase: ServerClient) {
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

  const isConsumer = me?.account_type === "consumer";
  const isApprovedPro =
    me?.account_type === "professional" &&
    me?.application_status === "approved";
  if (!isConsumer && !isApprovedPro) {
    return { error: "You can't follow people with this account." as const };
  }

  return { user };
}

/**
 * Follow a pro from the Fan app. Inserts the follow edge (RLS also requires
 * follower_id = auth.uid() and is_member()). Unlike the Pro action in
 * app/network/actions.ts this writes NO 'started_following' activity event — the
 * fan feed is simply the people they follow, and the activity_events INSERT
 * policy stays pros-only. Kept separate so the Pro path (which records activity)
 * is untouched.
 */
export async function followPro(targetId: string) {
  const supabase = await createClient();
  const auth = await requireMember(supabase);
  if ("error" in auth) return auth;

  if (targetId === auth.user.id) {
    return { error: "You can't follow yourself." };
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: auth.user.id, following_id: targetId });

  if (error) {
    // Already following — the composite PK collides; treat as success so the
    // toggle stays idempotent.
    if (error.code === "23505") {
      revalidatePath("/fan");
      revalidatePath("/fan/explore");
      return { success: true };
    }
    return { error: error.message };
  }

  revalidatePath("/fan");
  revalidatePath("/fan/explore");
  return { success: true };
}

/** Unfollow a pro. RLS ("Unfollow your own") limits the delete to your own
 *  edge; we pass follower_id in the filter as a second line of defence. */
export async function unfollowPro(targetId: string) {
  const supabase = await createClient();
  const auth = await requireMember(supabase);
  if ("error" in auth) return auth;

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", auth.user.id)
    .eq("following_id", targetId);

  if (error) return { error: error.message };

  revalidatePath("/fan");
  revalidatePath("/fan/explore");
  return { success: true };
}
