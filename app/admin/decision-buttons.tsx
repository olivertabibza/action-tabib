"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_REVIEW_REASON } from "@/lib/review-reasons";
import { decideApplication } from "./actions";
import type { ApplicationDecision } from "./schema";

/**
 * Approve / Reject / Re-queue controls for a single applicant. Only the
 * transitions that make sense from the current state are shown. After a
 * decision we refresh so the row drops off the current filtered list.
 */
export function DecisionButtons({
  profileId,
  current,
  initialReason = "",
}: {
  profileId: string;
  current: ApplicationDecision;
  /** The reason saved with the current decision, if any. */
  initialReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState(initialReason);

  function decide(decision: ApplicationDecision) {
    setError(null);
    startTransition(async () => {
      const result = await decideApplication(profileId, decision, reason);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`reason-${profileId}`} className="text-xs text-muted-foreground">
          Reason (optional, shown only to the applicant)
        </Label>
        <Textarea
          id={`reason-${profileId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={MAX_REVIEW_REASON}
          rows={2}
          placeholder="Say what to change, or why it was turned down."
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {current !== "approved" && (
          <Button size="sm" onClick={() => decide("approved")} disabled={pending}>
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
