"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applicationSchema, type ApplicationFormValues } from "../schema";
import { applyToProject } from "../actions";

export function ApplyForm({
  projectId,
  roleId,
}: {
  projectId: string;
  roleId?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: { note: "" },
  });

  function onSubmit(values: ApplicationFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await applyToProject(projectId, values, roleId);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="note">Add a note (optional)</Label>
        <Textarea
          id="note"
          rows={4}
          placeholder="Why you're a fit — relevant experience, availability, a link to your work."
          aria-invalid={!!errors.note}
          {...register("note")}
        />
        {errors.note && (
          <p className="text-sm text-destructive">{errors.note.message}</p>
        )}
      </div>

      {serverError && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {pending ? "Submitting…" : "Apply"}
        </Button>
      </div>
    </form>
  );
}
