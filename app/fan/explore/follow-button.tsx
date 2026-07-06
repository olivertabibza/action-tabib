"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { followPro, unfollowPro } from "../actions";

/**
 * Fan follow / Following toggle. Mirrors app/network/follow-button.tsx but calls
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

  function toggle() {
    startTransition(async () => {
      const result = following
        ? await unfollowPro(targetId)
        : await followPro(targetId);
      if (!result.error) {
        setFollowing((v) => !v);
        router.refresh();
      }
    });
  }

  return (
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
  );
}
