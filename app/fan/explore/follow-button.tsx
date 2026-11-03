"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { followPro, unfollowPro } from "../actions";

/**
 * Fan follow / Following toggle. Mirrors app/explore/(tab)/people/follow-button.tsx but calls
 * the fan-side actions (no activity_events write). Initial state comes from the
 * server; we flip it optimistically on success and refresh so the fan feed picks
 * up the change.
 */
export function FanFollowButton({
  targetId,
  initialFollowing,
}: {
  targetId: string;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  // Shown under the button when a follow/unfollow fails, so it never fails
  // silently (the button would just snap back with no explanation).
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const failed = following
      ? "Couldn't unfollow. Try again."
      : "Couldn't follow. Try again.";
    startTransition(async () => {
      try {
        const result = following
          ? await unfollowPro(targetId)
          : await followPro(targetId);
        if (result.error) {
          setError(failed);
          return;
        }
        setFollowing((v) => !v);
        router.refresh();
      } catch {
        setError(failed);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant={following ? "outline" : "default"}
        onClick={toggle}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : following ? (
          <Check className="size-3.5" />
        ) : (
          <Plus className="size-3.5" />
        )}
        {following ? "Following" : "Follow"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
