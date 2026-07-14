import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, MailQuestion } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { titleCase } from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { getInbox, type ConversationSummary } from "./data";
import { RequestButtons } from "./request-buttons";

// Auth + approved-pro gate and the ProShell come from app/messages/layout.tsx.
// Two tabs via ?tab=: Chats (my accepted threads) and Requests (not yet
// accepted), matching mockup P5.

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { chats, requests } = await getInbox(supabase, user.id);
  const active = tab === "requests" ? "requests" : "chats";
  const rows = active === "requests" ? requests : chats;

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Messages</h1>

      {/* Tabs */}
      <div className="mt-4 flex gap-1">
        <TabLink href="/messages" label="Chats" active={active === "chats"} />
        <TabLink
          href="/messages?tab=requests"
          label="Requests"
          active={active === "requests"}
          badge={requests.length}
        />
      </div>

      {rows.length > 0 ? (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <ConversationRow key={r.conversationId} row={r} />
          ))}
        </ul>
      ) : active === "requests" ? (
        <EmptyState
          icon={<MailQuestion className="size-7 text-muted-foreground" />}
          title="No requests"
          body="Message requests from people you don't follow will show up here."
        />
      ) : (
        <EmptyState
          icon={<Inbox className="size-7 text-muted-foreground" />}
          title="No messages yet"
          body="Start a conversation from someone's profile or the Network tab."
        />
      )}
    </main>
  );
}

function TabLink({
  href,
  label,
  active,
  badge,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "bg-brand text-brand-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      {badge && badge > 0 ? (
        <span
          className={cn(
            "flex min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold leading-5",
            active
              ? "bg-brand-foreground/20 text-brand-foreground"
              : "bg-brand text-brand-foreground"
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function ConversationRow({ row }: { row: ConversationSummary }) {
  const name = row.otherName || "A member";
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <Link href={`/messages/${row.conversationId}`} className="shrink-0">
          <Avatar name={name} />
        </Link>
        <Link
          href={`/messages/${row.conversationId}`}
          className="min-w-0 flex-1"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate",
                row.unread ? "font-semibold" : "font-medium"
              )}
            >
              {name}
              {row.otherRole ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  · {titleCase(row.otherRole)}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {timeLabel(row.lastAt)}
            </span>
          </div>
          <p
            className={cn(
              "mt-0.5 truncate text-sm",
              row.unread ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {row.lastBody || "No messages yet"}
          </p>
        </Link>
        {row.accepted && row.unread ? (
          <span
            aria-label="Unread"
            className="mt-1.5 size-2 shrink-0 rounded-full bg-brand"
          />
        ) : null}
      </div>

      {/* Requests get inline Accept / Ignore. */}
      {!row.accepted && (
        <div className="mt-2 pl-[3.25rem]">
          <RequestButtons conversationId={row.conversationId} />
        </div>
      )}
    </li>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
      {icon}
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
