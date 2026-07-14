"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { openConversation } from "./actions";

/**
 * "Message" entry point used from a pro's profile and the Network cards. Opens
 * (or starts) the thread with `otherId` and navigates into it. Only render this
 * for an approved pro viewing ANOTHER approved pro — never on your own profile.
 */
export function MessageButton({
  otherId,
  size = "sm",
  variant = "outline",
  className,
  label = "Message",
}: {
  otherId: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    startTransition(async () => {
      const result = await openConversation(otherId);
      if ("conversationId" in result) {
        router.push(`/messages/${result.conversationId}`);
        return;
      }
      setError(result.error ?? "Couldn't open the conversation.");
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={open}
        disabled={pending}
        className={className}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MessageSquare className="size-4" />
        )}
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
