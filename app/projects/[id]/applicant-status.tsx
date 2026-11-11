"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setApplicationStatus, type ApplicationStatus } from "../actions";

const PILL: Record<ApplicationStatus, { label: string; className: string }> = {
  submitted: { label: "New", className: "bg-muted text-muted-foreground" },
  shortlisted: { label: "Shortlisted", className: "bg-brand/10 text-brand" },
  declined: {
    label: "Declined",
    className: "bg-destructive/10 text-destructive",
  },
};

/** An applicant's status, as a pill. */
export function ApplicantStatusPill({ status }: { status: string }) {
  const pill = PILL[status as ApplicationStatus] ?? PILL.submitted;
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${pill.className}`}
    >
      {pill.label}
    </span>
  );
}

/** Owner-only: Shortlist / Decline, and Move back to new once decided. */
export function ApplicantStatusButtons({
  projectId,
  applicationId,
  status,
}: {
  projectId: string;
  applicationId: string;
  status: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<ApplicationStatus | null>(null);

  function set(next: ApplicationStatus) {
    setError(null);
    setTarget(next);
    startTransition(async () => {
      const result = await setApplicationStatus(projectId, applicationId, next);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const spinner = (next: ApplicationStatus) =>
    pending && target === next ? <Loader2 className="size-4 animate-spin" /> : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {status !== "shortlisted" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => set("shortlisted")}
            disabled={pending}
          >
            {spinner("shortlisted")}
            Shortlist
          </Button>
        )}
        {status !== "declined" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => set("declined")}
            disabled={pending}
          >
            {spinner("declined")}
            Decline
          </Button>
        )}
        {status !== "submitted" && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => set("submitted")}
            disabled={pending}
          >
            {spinner("submitted")}
            Move back to new
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
