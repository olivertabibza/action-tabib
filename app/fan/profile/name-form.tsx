"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateFanName } from "../actions";

/**
 * "Edit profile" for fans (UX B-13): their name is the only thing a fan's
 * profile has, so editing happens right here instead of five taps away on a
 * pro-shaped form that asks for a film role and a headline.
 */
export function FanNameForm({ currentName }: { currentName: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!currentName);
  const [name, setName] = useState(currentName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setEditing(true)}
      >
        <Pencil className="size-3.5" />
        Edit profile
      </Button>
    );
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateFanName(name);
        if (result.error) {
          setError(result.error);
          return;
        }
        setEditing(false);
        router.refresh();
      } catch {
        setError("Couldn't save your name. Try again.");
      }
    });
  }

  return (
    <form onSubmit={save} className="flex w-full max-w-sm flex-col gap-2">
      <Label htmlFor="fan-display-name">
        {currentName ? "Your name" : "Add your name"}
      </Label>
      <div className="flex gap-2">
        <Input
          id="fan-display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoComplete="name"
          aria-invalid={!!error}
          aria-describedby={error ? "fan-display-name-error" : undefined}
        />
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
        {currentName && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setName(currentName);
              setError(null);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        )}
      </div>
      {error && (
        <p id="fan-display-name-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
