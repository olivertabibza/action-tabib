"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { decideContent } from "./actions";
import type { ContentDecision, ContentKind } from "./schema";

/**
 * Publish / Reject / Re-queue controls for a single event or article. Mirrors
 * DecisionButtons (applications), but the statuses are content statuses. Only the
 * transitions that make sense from the current status are shown; after a
 * decision we refresh so the row drops off the current filtered list.
 */
export function ContentDecisionButtons({
  kind,
  id,
  current,
}: {
  kind: ContentKind;
  id: string;
  current: ContentDecision;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(decision: ContentDecision) {
    setError(null);
    startTransition(async () => {
      const result = await decideContent(kind, id, decision);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {current !== "published" && (
          <Button
            size="sm"
            onClick={() => decide("published")}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Approve
          </Button>
        )}
        {current !== "rejected" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => decide("rejected")}
            disabled={pending}
          >
            <X className="size-4" />
            Reject
          </Button>
        )}
        {current !== "pending" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => decide("pending")}
            disabled={pending}
          >
            <RotateCcw className="size-4" />
            Re-queue
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
