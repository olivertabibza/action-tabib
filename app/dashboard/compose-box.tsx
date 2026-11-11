"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { CallboardCard } from "@/components/CallboardCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { statusUpdateSchema, type StatusUpdateValues } from "./schema";
import { postStatusUpdate } from "./actions";

export function ComposeBox({
  displayName,
  photoPath,
}: {
  displayName?: string | null;
  photoPath?: string | null;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StatusUpdateValues>({
    resolver: zodResolver(statusUpdateSchema),
    defaultValues: { body: "" },
  });

  function onSubmit(values: StatusUpdateValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await postStatusUpdate(values);
      if (result.error) {
        setServerError(result.error);
        return;
      }
      reset();
      router.refresh();
    });
  }

  return (
    <CallboardCard className="p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar
            name={displayName}
            photoPath={photoPath}
            className="size-11 bg-avatar-fill text-text-secondary"
          />
          <Textarea
            rows={1}
            className="min-h-0 flex-1 resize-none rounded-full border-border-hairline bg-surface-sunken px-[18px] py-[13px] text-[15px]"
            placeholder="Share an update with your circle…"
            aria-invalid={!!errors.body}
            aria-describedby={errors.body ? "compose-body-error" : undefined}
            aria-label="Status update"
            {...register("body")}
          />
        </div>
        {errors.body && (
          <p id="compose-body-error" className="text-sm text-destructive">
            {errors.body.message}
          </p>
        )}
        {serverError && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </p>
        )}
        {/* UX B-07: the Still · Milestone · Project · Class note chips were
            disabled placeholders (only text posts exist), so they're gone. */}
        <div className="flex items-center justify-end">
          <Button
            type="submit"
            disabled={pending}
            className="h-auto rounded-full px-[22px] py-[9px] text-sm font-semibold"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? "Posting…" : "Post"}
          </Button>
        </div>
      </form>
    </CallboardCard>
  );
}
