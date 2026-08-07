"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  acceptConnection,
  removeConnection,
  requestConnection,
} from "./connection-actions";

/** The Connect pill's state for one profile, derived from the viewer's own
 * connection rows (see supabase/connections.sql). */
export type ConnectionState =
  | "none"
  | "pending_outgoing"
  | "pending_incoming"
  | "connected";

const LABELS: Record<ConnectionState, string> = {
  none: "Connect",
  pending_outgoing: "Pending",
  pending_incoming: "Accept",
  connected: "Connected",
};

/**
 * Connect / Pending / Accept / Connected, one button covering every transition.
 * Initial state comes from the server (one grouped connections query in
 * page.tsx); we flip it on success and refresh so mutual counts and the
 * requests card re-derive. There is no toast primitive in this repo, so a
 * failed action surfaces its message as the button's title.
 */
export function ConnectPill({
  targetId,
  initialState,
}: {
  targetId: string;
  initialState: ConnectionState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function click() {
    setError(null);
    startTransition(async () => {
      let result: { error?: string };
      let next: ConnectionState;

      if (state === "none") {
        result = await requestConnection(targetId);
        next = "pending_outgoing";
      } else if (state === "pending_incoming") {
        result = await acceptConnection(targetId);
        next = "connected";
      } else {
        // Withdraw a pending request or disconnect — same delete either way.
        result = await removeConnection(targetId);
        next = "none";
      }

      if (result.error) {
        setError(result.error);
        return;
      }
      setState(next);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={pending}
      title={error ?? undefined}
      className={cn(
        "focus-ring flex shrink-0 items-center gap-1.5 rounded-full px-[18px] py-[7px] text-[13.5px] font-semibold transition-[background-color,opacity] disabled:opacity-60",
        state === "none"
          ? "border-[1.5px] border-accent text-accent hover:bg-accent-tint"
          : "bg-accent-tint text-accent hover:opacity-80"
      )}
    >
      {pending && <Loader2 className="size-3.5 animate-spin" />}
      {LABELS[state]}
    </button>
  );
}
