"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Briefcase,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  Star,
  type LucideIcon,
} from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { CallboardCard } from "@/components/CallboardCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { statusUpdateSchema, type StatusUpdateValues } from "./schema";
import { postStatusUpdate } from "./actions";

// STUBBED post-kind chips (design: Still · Milestone · Project · Class note).
// activity_events.kind (supabase/social-feed.sql) is CHECK-constrained and its
// INSERT policy only permits 'status_update' and 'started_following', so these
// render per the design but stay aria-disabled — a new post kind needs a
// migration in supabase/social-feed.sql before any chip can go live.
const KIND_CHIPS: { icon: LucideIcon; label: string }[] = [
  { icon: ImageIcon, label: "Still" },
  { icon: Star, label: "Milestone" },
  { icon: Briefcase, label: "Project" },
  { icon: GraduationCap, label: "Class note" },
];

export function ComposeBox({ displayName }: { displayName?: string | null }) {
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
            className="size-11 bg-avatar-fill text-text-secondary"
          />
          <Textarea
            rows={1}
            className="min-h-0 flex-1 resize-none rounded-full border-border-hairline bg-surface-sunken px-[18px] py-[13px] text-[15px]"
            placeholder="Share an update with your circle…"
            aria-invalid={!!errors.body}
            aria-label="Status update"
            {...register("body")}
          />
        </div>
        {errors.body && (
          <p className="text-sm text-destructive">{errors.body.message}</p>
        )}
        {serverError && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </p>
        )}
        <div className="flex items-center gap-2">
          {KIND_CHIPS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              aria-disabled
              tabIndex={-1}
              className="pointer-events-none flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[13px] font-semibold text-text-secondary max-sm:hidden"
            >
              <Icon className="size-4" strokeWidth={1.5} />
              {label}
            </button>
          ))}
          <span className="flex-1" />
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
