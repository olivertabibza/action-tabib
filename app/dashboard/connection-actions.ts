"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Re-read the session and confirm the caller is an approved professional.
 * RLS enforces this too, but we re-check server-side so the actions fail with a
 * friendly message rather than a raw policy error, and never trust the client.
 *
 * Deliberately a local copy of app/network/actions.ts's helper: neither file
 * should become a dependency of the other over five lines of session check.
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
 * Ask to connect. status is left to its 'pending' default — the INSERT policy
 * requires exactly that value, so passing it explicitly would only be a way to
 * get it wrong. No activity_events row: the schema has no connection kind, and
 * followCreator already writes the one relationship event that exists.
 */
export async function requestConnection(targetId: string) {
  const supabase = await createClient();
  const auth = await requireApprovedPro(supabase);
  if ("error" in auth) return auth;

  if (targetId === auth.user.id) {
    return { error: "You can't connect with yourself." };
  }

  const { error } = await supabase
    .from("connections")
    .insert({ requester_id: auth.user.id, addressee_id: targetId });

  // 23505 covers both "already asked" and the connections_pair_uniq index
  // catching a reciprocal request (they asked first). Either way the request
  // exists, so treat it as success and let the refresh re-derive which state
  // that actually is.
  if (error && error.code !== "23505") {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/network");
  return { success: true };
}

/**
 * Accept a pending incoming request. The UPDATE policy already restricts this
 * to the addressee of a pending row and connections_freeze_pair blocks pair
 * rewrites; the explicit filters are a second line of defence, matching how
 * unfollowCreator filters on follower_id. A zero-row result means the request
 * was withdrawn or already answered, so say so rather than silently no-op.
 */
export async function acceptConnection(requesterId: string) {
  const supabase = await createClient();
  const auth = await requireApprovedPro(supabase);
  if ("error" in auth) return auth;

  const { error, count } = await supabase
    .from("connections")
    .update(
      { status: "accepted", responded_at: new Date().toISOString() },
      { count: "exact" }
    )
    .eq("requester_id", requesterId)
    .eq("addressee_id", auth.user.id)
    .eq("status", "pending");

  if (error) return { error: error.message };
  if (!count) return { error: "That request is no longer available." };

  revalidatePath("/dashboard");
  revalidatePath("/network");
  return { success: true };
}

/**
 * Withdraw a pending request you sent, decline a pending one you received, or
 * disconnect an accepted one — one action, because the DELETE policy ("Parties
 * delete own connections") permits all three identically and the pair is
 * unique, so at most one row can match either direction.
 */
export async function removeConnection(otherId: string) {
  const supabase = await createClient();
  const auth = await requireApprovedPro(supabase);
  if ("error" in auth) return auth;

  const me = auth.user.id;
  const { error } = await supabase
    .from("connections")
    .delete()
    .or(
      `and(requester_id.eq.${me},addressee_id.eq.${otherId}),` +
        `and(requester_id.eq.${otherId},addressee_id.eq.${me})`
    );

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/network");
  return { success: true };
}
