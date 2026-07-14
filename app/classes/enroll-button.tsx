"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toggleEnrollment } from "./actions";

/**
 * Enroll / "Enrolled ✓" toggle. Initial state comes from the server; we flip it
 * optimistically on success and refresh so the seat count re-reads. Modeled on
 * RsvpButton, plus: when the class is full and you're not already in, the button
 * disables, and a rejected enroll (it filled up between render and click)
 * surfaces the action's "This class is full." message instead of flipping.
 */
export function EnrollButton({
  classId,
  initialEnrolled,
  spotsLeft,
  size = "default",
}: {
  classId: string;
  initialEnrolled: boolean;
  spotsLeft: number;
  size?: "sm" | "default" | "lg";
}) {
  const router = useRouter();
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const full = !enrolled && spotsLeft <= 0;

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleEnrollment(classId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEnrolled((v) => !v);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size={size}
        variant={enrolled ? "outline" : "default"}
        onClick={toggle}
        disabled={pending || full}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : enrolled ? (
          <Check className="size-4" />
        ) : null}
        {enrolled ? "Enrolled" : full ? "Class full" : "Enroll"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
