"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { messageSchema } from "./schema";
import { getUnreadChatCount } from "./data";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Re-read the session and confirm the caller is an approved professional. RLS
 * enforces this too; we re-check server-side so actions fail with a friendly
 * message rather than a raw policy error (mirrors app/explore/(tab)/people/actions.ts).
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
 * All the work is one DB call: public.open_conversation() (supabase/messages.sql)
 * normalises the pair, creates the conversation and participant rows atomically,
 * computes the recipient's free pass from the follow graph, and never re-creates
 * a row the other side removed with Ignore. Clients can't insert either table
 * directly. The checks here only exist to give friendly messages; the function
 * enforces them again, and any refusal it raises surfaces as a neutral error.
 */
export async function openConversation(otherUserId: string) {
  const supabase = await createClient();
  const auth = await requireApprovedPro(supabase);
  if ("error" in auth) return auth;

  if (otherUserId === auth.user.id) {
    return { error: "You can't message yourself." };
  }

  const { data: conversationId, error } = await supabase.rpc(
    "open_conversation",
    { p_other: otherUserId }
  );
  if (error || !conversationId) {
    return { error: "You can't message this person right now." };
  }

  revalidatePath("/messages");
  return { conversationId: conversationId as string };
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

/** Unread-conversation count for the ProShell badge (accepted threads only).
 *  Delegates to getUnreadChatCount so there is ONE unread rule in the codebase. */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  return getUnreadChatCount(supabase, user.id);
}
