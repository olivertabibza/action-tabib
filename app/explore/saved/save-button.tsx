"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toggleSave } from "./actions";

/**
 * Save / "Saved ✓" bookmark toggle. Initial state (initialSaved) comes from the
 * server; we flip it optimistically on success and refresh so the Fan Profile's
 * Saved list re-reads. Logged-out visitors get a plain "Save" button that LINKS
 * to /login rather than calling the action (which would redirect there anyway).
 */
export function SaveButton({
  itemType,
  itemId,
  initialSaved,
  loggedIn = true,
}: {
  itemType: "event" | "article";
  itemId: string;
  initialSaved: boolean;
  loggedIn?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  if (!loggedIn) {
    return (
      <Button asChild>
        <Link href="/login">
          <Bookmark className="size-4" />
          Save
        </Link>
      </Button>
    );
  }

  function toggle() {
    startTransition(async () => {
      const result = await toggleSave(itemType, itemId);
      if (!result?.error) {
        setSaved((v) => !v);
        router.refresh();
      }
    });
  }

  return (
    <Button
      type="button"
      variant={saved ? "outline" : "default"}
      onClick={toggle}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : saved ? (
        <BookmarkCheck className="size-4" />
      ) : (
        <Bookmark className="size-4" />
      )}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
