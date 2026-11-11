import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type ConversationSummary = {
  conversationId: string;
  otherId: string;
  otherName: string | null;
  otherRole: string | null;
  otherAvatarPath: string | null;
  lastBody: string | null;
  lastAt: string | null;
  accepted: boolean;
  unread: boolean;
};

export type Inbox = {
  chats: ConversationSummary[];
  requests: ConversationSummary[];
  unreadChats: number;
  /** Set when the inbox couldn't be loaded, so the page doesn't show an empty
   *  inbox ("No messages yet") for what is really a failed load. */
  error?: string;
};

const INBOX_ERROR = "Couldn't load your messages. Refresh to try again.";

/**
 * Build the current user's inbox in one place — reused by the Messages list, and
 * (for just the count) the unread badge. No realtime this pass: plain queries +
 * a JS reduce for "last message per conversation", which is fine at MVP scale.
 *
 * Which conversations are UNREAD comes from public.my_unread_conversations()
 * (supabase/messages.sql §7), the same rule the nav badge uses, so the two can't
 * disagree (audit ENG F09/F10).
 */
export async function getInbox(
  supabase: ServerClient,
  userId: string
): Promise<Inbox> {
  // My side of every conversation I'm in: accepted (Chats vs Requests) + read
  // cursor. RLS scopes this to my own participant rows.
  const { data: myRows, error: myRowsError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, accepted, last_read_at")
    .eq("user_id", userId);
  if (myRowsError) {
    console.error("getInbox: participant rows failed:", myRowsError);
    return { chats: [], requests: [], unreadChats: 0, error: INBOX_ERROR };
  }

  const mine = myRows ?? [];
  if (mine.length === 0) return { chats: [], requests: [], unreadChats: 0 };

  const convIds = mine.map((r) => r.conversation_id as string);

  // The other party in each of those conversations (RLS lets me read participant
  // rows for conversations I'm in).
  const { data: otherRows, error: otherRowsError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id")
    .in("conversation_id", convIds)
    .neq("user_id", userId);
  if (otherRowsError) {
    console.error("getInbox: other participants failed:", otherRowsError);
    return { chats: [], requests: [], unreadChats: 0, error: INBOX_ERROR };
  }
  const otherByConv = new Map<string, string>();
  for (const r of otherRows ?? [])
    otherByConv.set(r.conversation_id as string, r.user_id as string);

  // The other people's display bits.
  const otherIds = [...new Set([...otherByConv.values()])];
  const { data: profiles } = otherIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, role, avatar_path")
        .in("id", otherIds)
    : { data: [] };
  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id as string, p])
  );

  // The newest message in each of my conversations, one row each
  // (public.my_last_messages, supabase/messages.sql §7).
  const { data: msgs, error: msgsError } = await supabase.rpc(
    "my_last_messages"
  );
  if (msgsError) {
    console.error("getInbox: messages failed:", msgsError);
    return { chats: [], requests: [], unreadChats: 0, error: INBOX_ERROR };
  }
  // One unread rule for the inbox and the badge (see getUnreadChatCount).
  const { data: unreadRows, error: unreadError } = await supabase.rpc(
    "my_unread_conversations"
  );
  if (unreadError) {
    console.error("getInbox: unread lookup failed:", unreadError);
    return { chats: [], requests: [], unreadChats: 0, error: INBOX_ERROR };
  }
  const unreadIds = new Set(
    ((unreadRows ?? []) as { conversation_id: string }[]).map(
      (r) => r.conversation_id
    )
  );

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
    const unread = unreadIds.has(cid);

    const summary: ConversationSummary = {
      conversationId: cid,
      otherId,
      otherName: (prof?.display_name as string | null) ?? null,
      otherRole: (prof?.role as string | null) ?? null,
      otherAvatarPath: (prof?.avatar_path as string | null) ?? null,
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

/**
 * Just the unread number for the ProShell nav badge: accepted conversations
 * (requests have their own tab) that public.my_unread_conversations() reports
 * as unread. One cheap call, and the same rule getInbox uses for its dots, so
 * the badge and the inbox always agree (audit ENG F09/F10).
 */
export async function getUnreadChatCount(
  supabase: ServerClient
): Promise<number> {
  const { data, error } = await supabase.rpc("my_unread_conversations");
  if (error) return 0;
  const rows = (data ?? []) as { accepted: boolean }[];
  return rows.filter((r) => r.accepted).length;
}
