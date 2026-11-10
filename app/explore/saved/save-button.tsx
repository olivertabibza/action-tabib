"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
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
  // Shown when a save/unsave fails, so it never fails silently.
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const failed = saved ? "Couldn't remove. Try again." : "Couldn't save. Try again.";
    startTransition(async () => {
      try {
        const result = await toggleSave(itemType, itemId);
        if (result?.error) {
          setError(failed);
          return;
        }
        setSaved((v) => !v);
        router.refresh();
      } catch (e) {
        // The action redirects to /login when the session is gone; let Next.js
        // handle that rather than showing it as a failure.
        unstable_rethrow(e);
        setError(failed);
      }
    });
  }

  const errorLine = error && (
    <p role="alert" className="text-xs text-destructive">
      {error}
    </p>
  );

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
    // The icon sits in a tight card header row, so its error floats below it
    // instead of pushing the row apart.
    return (
      <div className="relative inline-flex">
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
        {error && (
          <div className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-surface px-2 py-1 shadow-sm ring-1 ring-border">
            {errorLine}
          </div>
        )}
      </div>
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
    <div className="inline-flex flex-col items-start gap-1">
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
      {errorLine}
    </div>
  );
}
