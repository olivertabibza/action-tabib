import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type ConversationSummary = {
  conversationId: string;
  otherId: string;
  otherName: string | null;
  otherRole: string | null;
  lastBody: string | null;
  lastAt: string | null;
  accepted: boolean;
  unread: boolean;
};

export type Inbox = {
  chats: ConversationSummary[];
  requests: ConversationSummary[];
  unreadChats: number;
};

/**
 * Build the current user's inbox in one place — reused by the Messages list, and
 * (for just the count) the unread badge. No realtime this pass: plain queries +
 * a JS reduce for "last message per conversation", which is fine at MVP scale.
 *
 * A conversation is UNREAD when its last message is from the OTHER person and is
 * newer than my last_read_at (or I've never read it). We deliberately exclude my
 * own last message so sending never makes my own thread look unread to me.
 */
export async function getInbox(
  supabase: ServerClient,
  userId: string
): Promise<Inbox> {
  // My side of every conversation I'm in: accepted (Chats vs Requests) + read
  // cursor. RLS scopes this to my own participant rows.
  const { data: myRows } = await supabase
    .from("conversation_participants")
    .select("conversation_id, accepted, last_read_at")
    .eq("user_id", userId);

  const mine = myRows ?? [];
  if (mine.length === 0) return { chats: [], requests: [], unreadChats: 0 };

  const convIds = mine.map((r) => r.conversation_id as string);

  // The other party in each of those conversations (RLS lets me read participant
  // rows for conversations I'm in).
  const { data: otherRows } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id")
    .in("conversation_id", convIds)
    .neq("user_id", userId);
  const otherByConv = new Map<string, string>();
  for (const r of otherRows ?? [])
    otherByConv.set(r.conversation_id as string, r.user_id as string);

  // The other people's display bits.
  const otherIds = [...new Set([...otherByConv.values()])];
  const { data: profiles } = otherIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, role")
        .in("id", otherIds)
    : { data: [] };
  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id as string, p])
  );

  // All messages in my conversations, newest first; reduce to the last one per
  // conversation.
  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, sender_id, body, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false });
  const lastByConv = new Map<
    string,
    { sender_id: string; body: string; created_at: string }
  >();
  for (const m of msgs ?? []) {
    const cid = m.conversation_id as string;
    if (!lastByConv.has(cid))
      lastByConv.set(cid, {
        sender_id: m.sender_id as string,
        body: m.body as string,
        created_at: m.created_at as string,
      });
  }

  const chats: ConversationSummary[] = [];
  const requests: ConversationSummary[] = [];

  for (const row of mine) {
    const cid = row.conversation_id as string;
    const otherId = otherByConv.get(cid);
    if (!otherId) continue; // other side ignored/removed — nothing to show
    const prof = profileById.get(otherId);
    const last = lastByConv.get(cid);
    const lastReadAt = row.last_read_at as string | null;
    const unread =
      !!last &&
      last.sender_id !== userId &&
      (lastReadAt === null || last.created_at > lastReadAt);

    const summary: ConversationSummary = {
      conversationId: cid,
      otherId,
      otherName: (prof?.display_name as string | null) ?? null,
      otherRole: (prof?.role as string | null) ?? null,
      lastBody: last?.body ?? null,
      lastAt: last?.created_at ?? null,
      accepted: !!row.accepted,
      unread,
    };
    (row.accepted ? chats : requests).push(summary);
  }

  // Most-recent activity first within each tab.
  const byRecent = (a: ConversationSummary, b: ConversationSummary) =>
    (b.lastAt ?? "").localeCompare(a.lastAt ?? "");
  chats.sort(byRecent);
  requests.sort(byRecent);

  const unreadChats = chats.filter((c) => c.unread).length;
  return { chats, requests, unreadChats };
}
