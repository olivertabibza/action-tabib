"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toggleRsvp } from "./actions";

/**
 * RSVP / "Going ✓" toggle. Initial state (initialRsvped) comes from the server;
 * we flip it optimistically on success and refresh so the attendee count
 * re-reads. Logged-out visitors get a plain "RSVP" button that LINKS to /login
 * rather than calling the action (which would redirect there anyway).
 */
export function RsvpButton({
  eventId,
  initialRsvped,
  rsvpCount,
  loggedIn = true,
  size = "default",
}: {
  eventId: string;
  initialRsvped: boolean;
  rsvpCount?: number;
  loggedIn?: boolean;
  size?: "sm" | "default" | "lg";
}) {
  const router = useRouter();
  const [rsvped, setRsvped] = useState(initialRsvped);
  const [pending, startTransition] = useTransition();
  // Shown under the button when an RSVP change fails, so it never fails silently.
  const [error, setError] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <Button asChild size={size}>
        <Link href="/login">RSVP</Link>
      </Button>
    );
  }

  function toggle() {
    setError(null);
    const failed = "Couldn't update your RSVP. Try again.";
    startTransition(async () => {
      try {
        const result = await toggleRsvp(eventId);
        if (result?.error) {
          setError(failed);
          return;
        }
        setRsvped((v) => !v);
        router.refresh();
      } catch (e) {
        // The action redirects to /login when the session is gone; let Next.js
        // handle that rather than showing it as a failure.
        unstable_rethrow(e);
        setError(failed);
      }
    });
  }

  // Optimistically nudge the shown count so it doesn't lag the button by a tick.
  const shownCount =
    rsvpCount === undefined
      ? undefined
      : rsvpCount + (rsvped ? 1 : 0) - (initialRsvped ? 1 : 0);

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="inline-flex items-center gap-3">
        <Button
          type="button"
          size={size}
          variant={rsvped ? "outline" : "default"}
          onClick={toggle}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : rsvped ? (
            <Check className="size-4" />
          ) : null}
          {rsvped ? "Going" : "RSVP"}
        </Button>
        {shownCount !== undefined && shownCount > 0 ? (
          <span className="text-sm text-muted-foreground">
            {shownCount} going
          </span>
        ) : null}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
