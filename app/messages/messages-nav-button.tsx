"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";

import { getUnreadCount } from "./actions";

/**
 * The fixed top-right Messages button in the Pro shell, with an unread-count
 * badge. No realtime this pass: the count is fetched on mount and re-fetched on
 * every navigation (pathname change) — so reading a thread and coming back
 * updates it — without an interval poll. A brief no-badge flash on first paint
 * is fine.
 */
export function MessagesNavButton() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    getUnreadCount().then((c) => {
      if (active) setCount(c);
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  return (
    <Link
      href="/messages"
      aria-label={count > 0 ? `Messages, ${count} unread` : "Messages"}
      className="fixed right-4 top-4 z-50 flex size-10 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground supports-[backdrop-filter]:bg-background/80"
    >
      <MessageSquare className="size-5" strokeWidth={1.75} />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-semibold leading-5 text-brand-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
