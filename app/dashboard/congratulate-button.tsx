"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PartyPopper } from "lucide-react";

import { toggleCongratulate } from "./actions";
import { FeedAction } from "./feed-action";

/**
 * The Congratulate toggle. Flips optimistically (the reaction is a single row
 * either way), reverts and shows the reason as a title on failure, then
 * refreshes so the post's "N congratulated this" proof line re-counts.
 */
export function CongratulateButton({
  eventId,
  initialOn,
}: {
  eventId: string;
  initialOn: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initialOn);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);
    startTransition(async () => {
      const result = await toggleCongratulate(eventId, next);
      if (result.error) {
        setOn(!next);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <FeedAction
      interactive
      active={on}
      aria-pressed={on}
      title={error ?? undefined}
      onClick={toggle}
    >
      <PartyPopper className="size-[17px]" strokeWidth={1.5} />
      {on ? "Congratulated" : "Congratulate"}
    </FeedAction>
  );
}
