"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { acceptConnection, removeConnection } from "./connection-actions";

/**
 * Accept / Decline for one incoming request in the right-rail card. Declining
 * is removeConnection — the DELETE policy treats declining, withdrawing and
 * disconnecting identically. The row itself disappears on the refresh that
 * follows a successful action.
 */
export function ConnectionRequestActions({
  requesterId,
  className,
}: {
  requesterId: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(action: "accept" | "decline") {
    setBusy(action);
    setError(null);
    startTransition(async () => {
      const result =
        action === "accept"
          ? await acceptConnection(requesterId)
          : await removeConnection(requesterId);
      if (result.error) {
        setError(result.error);
        setBusy(null);
        return;
      }
      router.refresh();
      setBusy(null);
    });
  }

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title={error ?? undefined}
    >
      <button
        type="button"
        onClick={() => run("accept")}
        disabled={busy !== null}
        className="focus-ring flex items-center gap-1.5 rounded-full bg-accent px-4 py-[7px] text-[13px] font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy === "accept" && <Loader2 className="size-3.5 animate-spin" />}
        Accept
      </button>
      <button
        type="button"
        onClick={() => run("decline")}
        disabled={busy !== null}
        className="focus-ring flex items-center gap-1.5 rounded-full px-2.5 py-[7px] text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary disabled:opacity-60"
      >
        {busy === "decline" && <Loader2 className="size-3.5 animate-spin" />}
        Decline
      </button>
    </div>
  );
}
