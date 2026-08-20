"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toggleSave } from "./actions";

/**
 * Save / "Saved ✓" bookmark toggle. Initial state (initialSaved) comes from the
 * server; we flip it optimistically on success and refresh so the Fan Profile's
 * Saved list re-reads. Logged-out visitors get a plain "Save" button that LINKS
 * to /login rather than calling the action (which would redirect there anyway).
 *
 * `variant="icon"` is the Callboard bookmark icon the Projects cards use
 * (design/handoff/README.md §2) — same action, no label, no button chrome.
 */
export function SaveButton({
  itemType,
  itemId,
  initialSaved,
  loggedIn = true,
  variant = "button",
}: {
  itemType: "event" | "article" | "project";
  itemId: string;
  initialSaved: boolean;
  loggedIn?: boolean;
  variant?: "button" | "icon";
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await toggleSave(itemType, itemId);
      if (!result?.error) {
        setSaved((v) => !v);
        router.refresh();
      }
    });
  }

  if (variant === "icon") {
    if (!loggedIn) {
      return (
        <Link
          href="/login"
          aria-label="Log in to save"
          className="focus-ring flex size-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:text-accent"
        >
          <Bookmark className="size-5" strokeWidth={1.5} />
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? "Remove bookmark" : "Bookmark"}
        className={cn(
          "focus-ring flex size-8 items-center justify-center rounded-full transition-colors hover:text-accent disabled:opacity-60",
          saved ? "text-accent" : "text-text-tertiary"
        )}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Bookmark
            className={cn("size-5", saved && "fill-current")}
            strokeWidth={1.5}
          />
        )}
      </button>
    );
  }

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
