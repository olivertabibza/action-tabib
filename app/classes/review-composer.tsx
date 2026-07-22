"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitReview, deleteReview } from "./actions";

/**
 * Star-picker + textarea for reviewing a class. Rendered only for enrolled
 * viewers (the page checks); RLS backs that up server-side. If the viewer
 * already reviewed, the server prefills their rating/body and the button reads
 * "Update review" — submitting again upserts onto the same row. Modeled on
 * EnrollButton: useTransition + router.refresh() so the summary re-reads.
 */
export function ReviewComposer({
  classId,
  initialRating,
  initialBody,
}: {
  classId: string;
  initialRating: number | null;
  initialBody: string;
}) {
  const router = useRouter();
  const hasReview = initialRating !== null;
  const [rating, setRating] = useState(initialRating ?? 0);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (rating < 1) {
      setError("Pick a star rating first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitReview(classId, rating, body);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteReview(classId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // The component instance survives router.refresh(), so clear the local
      // state ourselves — otherwise the old rating/body linger in the form.
      setRating(0);
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">
        {hasReview ? "Your review" : "Review this class"}
      </p>

      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setRating(n)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                "size-5",
                n <= rating
                  ? "fill-amber-500 text-amber-500"
                  : "text-muted-foreground/40"
              )}
            />
          </button>
        ))}
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What should other pros know about this class? (optional)"
        maxLength={1000}
        className="mt-3"
      />

      <div className="mt-3 flex items-center gap-3">
        <Button type="button" size="sm" onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {hasReview ? "Update review" : "Submit review"}
        </Button>
        {hasReview && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            Delete
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
