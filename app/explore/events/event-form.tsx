"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { EVENT_TYPES, eventTypeLabel } from "@/lib/content";
import { eventSchema, type EventFormValues } from "./schema";
import { createEvent } from "./actions";

export function EventForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      event_type: "screening",
      date: "",
      time: "",
      venue: "",
      description: "",
    },
  });

  function onSubmit(values: EventFormValues) {
    setServerError(null);
    startTransition(async () => {
      // On success the action redirects to /explore, so control returns here
      // only when something went wrong.
      const result = await createEvent(values);
      if (result?.error) {
        setServerError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="e.g. Short film screening + Q&A"
          aria-invalid={!!errors.title}
          {...register("title")}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="event_type">Event type</Label>
        <NativeSelect
          id="event_type"
          aria-invalid={!!errors.event_type}
          {...register("event_type")}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {eventTypeLabel(t)}
            </option>
          ))}
        </NativeSelect>
        {errors.event_type && (
          <p className="text-sm text-destructive">
            {errors.event_type.message}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            aria-invalid={!!errors.date}
            {...register("date")}
          />
          {errors.date && (
            <p className="text-sm text-destructive">{errors.date.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="time">Start time</Label>
          <Input
            id="time"
            type="time"
            aria-invalid={!!errors.time}
            {...register("time")}
          />
          {errors.time && (
            <p className="text-sm text-destructive">{errors.time.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="venue">Venue</Label>
        <Input
          id="venue"
          placeholder="Leave blank for virtual"
          aria-invalid={!!errors.venue}
          {...register("venue")}
        />
        {errors.venue && (
          <p className="text-sm text-destructive">{errors.venue.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={6}
          placeholder="What's the event, who's it for, and what to expect."
          aria-invalid={!!errors.description}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
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

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Submitting…" : "Submit for review"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/explore")}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
