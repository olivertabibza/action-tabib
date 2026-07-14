"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { messageSchema } from "./schema";
import { getInbox } from "./data";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Re-read the session and confirm the caller is an approved professional. RLS
 * enforces this too; we re-check server-side so actions fail with a friendly
 * message rather than a raw policy error (mirrors app/network/actions.ts).
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
    return { error: "Only approved professionals can message." as const };
  }
  return { user };
}

/**
 * Open (or start) the thread between the caller and otherUserId, returning its
 * conversation id — the page then redirects to /messages/[id].
 *
 * The pair is normalised to canonical (user_a < user_b) order before any lookup
 * or insert (see supabase/messages.sql — the whole model depends on it).
 *
 * Participant seeding has two cases, and the split is what makes Ignore stick:
 *   - NEW conversation: seed BOTH rows. Mine = accepted. Theirs = accepted ONLY
 *     if they already follow me (the free pass) — otherwise the cold DM lands in
 *     their Requests. "They follow me" = a follows row (follower = them,
 *     following = me).
 *   - EXISTING conversation: only ensure MY OWN row (accepted = true). We never
 *     touch the other side — so a recipient re-opening a thread they'd ignored
 *     re-creates THEIR row (history intact), but an ignored SENDER re-opening
 *     can NOT resurrect the recipient's deleted row.
 */
export async function openConversation(otherUserId: string) {
  const supabase = await createClient();
  const auth = await requireApprovedPro(supabase);
  if ("error" in auth) return auth;
  const me = auth.user.id;

  if (otherUserId === me) {
    return { error: "You can't message yourself." };
  }

  const [user_a, user_b] = me < otherUserId ? [me, otherUserId] : [otherUserId, me];

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();

  let conversationId: string;

  if (existing) {
    conversationId = existing.id as string;
    // Ensure only my own row (re-creates it if I'd ignored this thread before).
    const { error } = await supabase
      .from("conversation_participants")
      .upsert(
        { conversation_id: conversationId, user_id: me, accepted: true },
        { onConflict: "conversation_id,user_id" }
      );
    if (error) return { error: error.message };
  } else {
    const { data: created, error: convErr } = await supabase
      .from("conversations")
      .insert({ user_a, user_b })
      .select("id")
      .single();
    if (convErr || !created) {
      return { error: convErr?.message ?? "Couldn't start the conversation." };
    }
    conversationId = created.id as string;

    // Free pass: does the OTHER person already follow ME? If so their row starts
    // accepted (straight to Chats); otherwise it's a cold DM (their Requests).
    const { data: theyFollowMe } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", otherUserId)
      .eq("following_id", me)
      .maybeSingle();

    const { error: partErr } = await supabase
      .from("conversation_participants")
      .insert([
        { conversation_id: conversationId, user_id: me, accepted: true },
        {
          conversation_id: conversationId,
          user_id: otherUserId,
          accepted: !!theyFollowMe,
        },
      ]);
    if (partErr) return { error: partErr.message };
  }

  revalidatePath("/messages");
  return { conversationId };
}

/**
 * Send a message. We let the RLS insert policy be the one thing that stops an
 * ignored sender (the other party's participant row is gone). If the insert is
 * rejected we return a neutral error — never crash, never reveal the ignore.
 */
export async function sendMessage(conversationId: string, body: string) {
  const parsed = messageSchema.safeParse({ body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Write a message first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session has expired. Please log in again." };
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: parsed.data.body,
  });
  if (error) {
    return { error: "You can't reply to this conversation." };
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { success: true };
}

/** Accept a request: flip MY own participant row to accepted (RLS scopes it). */
export async function acceptRequest(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Please log in again." };

  const { error } = await supabase
    .from("conversation_participants")
    .update({ accepted: true })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  return { success: true };
}

/** Ignore a request: DELETE my own participant row (hides it and blocks the
 *  sender — see the messages insert policy). RLS scopes the delete to my row. */
export async function ignoreRequest(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Please log in again." };

  const { error } = await supabase
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/messages");
  return { success: true };
}

/** Mark the thread read: set MY last_read_at = now() (drives the unread badge). */
export async function markRead(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Please log in again." };

  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/messages");
  return { success: true };
}

/** Unread-conversation count for the ProShell badge (accepted threads only). */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { unreadChats } = await getInbox(supabase, user.id);
  return unreadChats;
}
