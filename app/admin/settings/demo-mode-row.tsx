"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { setDemoMode } from "../actions";

/**
 * The demo-mode switch: while on, scanning the event QR code (/demo) signs a
 * guest straight in as an approved pro named "Guest N". Same switch styling
 * as AutoApproveRow, without the bulk-approve action.
 */
export function DemoModeRow({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setDemoMode(!enabled);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="demo-mode" className="flex flex-col gap-0.5">
          <span className="font-medium">Demo mode</span>
          <span className="text-sm text-muted-foreground">
            {enabled
              ? "Opening /demo signs a guest in as an approved pro."
              : "/demo is closed and sends visitors to the home page."}
          </span>
        </label>
        <button
          id="demo-mode"
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          onClick={toggle}
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

      <p className="text-sm text-muted-foreground">
        For live events. Guests get their own account, named Guest 1, Guest 2
        and so on, and are left out of People, Explore and search. Turning this
        off stops new guests but keeps existing ones signed in.
      </p>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
