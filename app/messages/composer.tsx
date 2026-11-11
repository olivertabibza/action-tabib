"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendMessage } from "./actions";

/**
 * Bottom-pinned message composer. Sends via the server action; on success clears
 * the box and refreshes so the new message (and read state) re-render. A rejected
 * send (e.g. the recipient ignored the thread) surfaces the action's neutral
 * error — it never reveals that you were ignored.
 *
 * Send guard: only one send at a time (a ref, because `pending` from the
 * transition isn't true yet on a fast double Enter). The box clears as soon as a
 * send starts, so anything typed while it's in flight is a new draft that the
 * send never touches. If the send fails, the unsent text comes back (ahead of
 * any new draft) so nothing is lost.
 *
 * Each send carries a client id, and a retry of the same text reuses it, so if
 * the first attempt did reach the server (say the connection dropped on the
 * way back) the database recognises the retry and nothing is posted twice.
 */
export function Composer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sending = useRef(false);
  const lastFailed = useRef<{ body: string; clientId: string } | null>(null);

  function submit() {
    const trimmed = body.trim();
    if (!trimmed || sending.current) return;
    sending.current = true;
    const clientId =
      lastFailed.current?.body === trimmed
        ? lastFailed.current.clientId
        : crypto.randomUUID();
    setBody("");
    setError(null);
    const restoreUnsent = () => {
      lastFailed.current = { body: trimmed, clientId };
      setBody((draft) => (draft.trim() ? `${trimmed}\n${draft}` : trimmed));
    };
    startTransition(async () => {
      try {
        const result = await sendMessage(conversationId, trimmed, clientId);
        if (result?.error) {
          setError(result.error);
          restoreUnsent();
          return;
        }
        lastFailed.current = null;
        router.refresh();
      } catch {
        setError("Couldn't send. Check your connection and try again.");
        restoreUnsent();
      } finally {
        sending.current = false;
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter makes a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Write a message…"
          className="min-h-11 flex-1 resize-none"
          aria-invalid={!!error}
        />
        <Button
          type="button"
          size="icon"
          onClick={submit}
          disabled={pending || !body.trim()}
          aria-label="Send"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizontal className="size-4" />
          )}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
