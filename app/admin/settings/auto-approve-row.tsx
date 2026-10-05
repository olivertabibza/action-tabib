"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { approveAllPending, setAutoApprove } from "../actions";
import type { AutoApproveKind } from "../schema";

/**
 * One auto-approve switch plus its "Approve all pending (N)" action. The bulk
 * approve asks for an in-page confirmation first; after either action we
 * refresh so the switch state and the count come back from the server.
 */
export function AutoApproveRow({
  kind,
  label,
  noun,
  note,
  enabled,
  pending,
}: {
  kind: AutoApproveKind;
  label: string;
  noun: string;
  note?: string;
  enabled: boolean;
  pending: number;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      setConfirming(false);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const switchId = `auto-approve-${kind}`;

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={switchId} className="flex flex-col gap-0.5">
          <span className="font-medium">{label}</span>
          <span className="text-sm text-muted-foreground">
            {enabled ? "New submissions are approved instantly." : "New submissions wait for review."}
          </span>
        </label>
        <button
          id={switchId}
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          onClick={() => run(() => setAutoApprove(kind, !enabled))}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
            enabled ? "bg-brand" : "bg-muted-foreground/30"
          )}
        >
          <span
            className={cn(
              "inline-block size-5 rounded-full bg-background shadow transition-transform",
              enabled ? "translate-x-5.5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {note && <p className="text-sm text-muted-foreground">{note}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-sm">
              Approve all pending {noun} ({pending} right now)?
            </span>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => run(() => approveAllPending(kind))}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || pending === 0}
            onClick={() => setConfirming(true)}
          >
            Approve all pending ({pending})
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
