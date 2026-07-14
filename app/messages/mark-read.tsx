"use client";

import { useEffect } from "react";

import { markRead } from "./actions";

/**
 * Fire markRead once when the thread mounts. Done in a client effect (not during
 * server render) so we're not mutating while rendering; the action revalidates
 * /messages so the inbox and the unread badge catch up on the next visit.
 */
export function MarkRead({ conversationId }: { conversationId: string }) {
  useEffect(() => {
    markRead(conversationId);
  }, [conversationId]);
  return null;
}
