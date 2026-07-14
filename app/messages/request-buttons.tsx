"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { acceptRequest, ignoreRequest } from "./actions";

/**
 * Accept / Ignore controls for a message request. Mirrors DecisionButtons
 * (app/admin/decision-buttons.tsx): a transition + refresh after the action.
 * Accept moves the thread to Chats (a refresh re-renders the thread with the
 * composer); Ignore deletes my participant row (hides it and blocks the sender)
 * and returns to the inbox.
 */
export function RequestButtons({
  conversationId,
}: {
  conversationId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptRequest(conversationId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function ignore() {
    setError(null);
    startTransition(async () => {
      const result = await ignoreRequest(conversationId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // After ignoring, there's nothing to view — go back to the inbox.
      router.push("/messages");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={accept} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={ignore}
          disabled={pending}
        >
          <X className="size-4" />
          Ignore
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
