"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { markRead } from "./actions";

const POLL_MS = 8000;

/**
 * The scrolling message list of an open thread, plus what keeps it live
 * (audit ENG F10/F18, PX F18):
 *   - new messages show up without a reload: the page re-renders every few
 *     seconds while the tab is visible, and as soon as you come back to it;
 *   - the view opens on, and follows, the newest message, unless you've
 *     scrolled up to read older ones;
 *   - the thread is marked read whenever a newer message appears, and the page
 *     refreshes so the unread badge drops straight away.
 * `newestId` is the id of the newest message on screen.
 */
export function ThreadMessages({
  conversationId,
  newestId,
  className,
  children,
}: {
  conversationId: string;
  newestId: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router]);

  useEffect(() => {
    const el = box.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
    markRead(conversationId)
      .then(() => router.refresh())
      .catch(() => {
        // Not critical: the thread just stays unread until the next visit.
      });
  }, [conversationId, newestId, router]);

  return (
    <div
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className={className}
    >
      {children}
    </div>
  );
}
