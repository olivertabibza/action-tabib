"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { statusUpdateSchema, type StatusUpdateValues } from "./schema";
import { postStatusUpdate } from "./actions";

export function ComposeBox() {
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
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <Textarea
        rows={3}
        placeholder="Share an update…"
        aria-invalid={!!errors.body}
        aria-label="Status update"
        {...register("body")}
      />
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
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Posting…" : "Post update"}
        </Button>
      </div>
    </form>
  );
}
