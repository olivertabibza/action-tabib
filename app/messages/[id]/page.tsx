import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { titleCase } from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { Composer } from "../composer";
import { RequestButtons } from "../request-buttons";
import { MarkRead } from "../mark-read";

// Gated + shelled by app/messages/layout.tsx. The thread between me and the
// other party: header links to their profile, messages oldest→newest, composer
// pinned at the bottom (or Accept/Ignore if I haven't accepted the request yet).

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // The pair — RLS only returns it if I'm a party. Gives me the other party's id
  // even if THEY ignored (deleted their participant row); I can still read the
  // history, I just can't send (the DB blocks that).
  const { data: conv } = await supabase
    .from("conversations")
    .select("user_a, user_b")
    .eq("id", id)
    .maybeSingle();
  if (!conv) {
    notFound();
  }

  // My own participant row. Missing = I ignored this thread (or was never in it)
  // → it isn't mine to view.
  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("accepted")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mine) {
    notFound();
  }

  const otherId =
    conv.user_a === user.id ? (conv.user_b as string) : (conv.user_a as string);

  const { data: other } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", otherId)
    .maybeSingle();
  const otherName = other?.display_name || "A member";

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  return (
    <main className="flex h-[calc(100dvh-1px)] flex-1 flex-col px-4 py-4 md:h-screen">
      {/* Mark read once mounted (updates the inbox + badge on next visit). */}
      <MarkRead conversationId={id} />

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Link
          href="/messages"
          aria-label="Back to messages"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <Link href={`/profile/${otherId}`} className="flex items-center gap-3">
          <Avatar name={otherName} className="size-9" />
          <span>
            <span className="font-semibold">{otherName}</span>
            {other?.role ? (
              <span className="ml-1 text-sm text-muted-foreground">
                · {titleCase(other.role)}
              </span>
            ) : null}
          </span>
        </Link>
      </div>

      {/* Messages, oldest→newest */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto py-4">
        {(messages ?? []).length === 0 ? (
          <p className="m-auto max-w-xs text-center text-sm text-muted-foreground">
            No messages yet. Say hello.
          </p>
        ) : (
          (messages ?? []).map((m) => {
            const mineMsg = m.sender_id === user.id;
            return (
              <div
                key={m.id}
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                  mineMsg
                    ? "self-end bg-brand text-brand-foreground"
                    : "self-start bg-muted text-foreground"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Composer, or Accept/Ignore if this is still a request to me */}
      <div className="border-t border-border pt-3">
        {mine.accepted ? (
          <Composer conversationId={id} />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {otherName} sent you a message request. Accept to reply.
            </p>
            <RequestButtons conversationId={id} />
          </div>
        )}
      </div>
    </main>
  );
}
