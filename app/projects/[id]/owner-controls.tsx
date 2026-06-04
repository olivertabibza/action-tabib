"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setProjectStatus } from "../actions";

/** Owner-only toggle to open / close a project. */
export function OwnerControls({
  projectId,
  status,
}: {
  projectId: string;
  status: "open" | "closed";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const closing = status === "open";

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setProjectStatus(
        projectId,
        closing ? "closed" : "open"
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={closing ? "outline" : "default"}
        onClick={toggle}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : closing ? (
          <Lock className="size-4" />
        ) : (
          <Unlock className="size-4" />
        )}
        {closing ? "Close project" : "Reopen project"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
