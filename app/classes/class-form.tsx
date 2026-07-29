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
import { PROJECT_DISCIPLINES, disciplineLabel } from "@/lib/marketplace";
import {
  CLASS_LEVELS,
  CLASS_FORMATS,
  classLevelLabel,
  classFormatLabel,
} from "@/lib/content";
import { classSchema, type ClassFormValues } from "./schema";
import { createClass } from "./actions";

export function ClassForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      title: "",
      discipline: "any",
      format: "in_person",
      level: "all",
      venue: "",
      price: 0,
      capacity: 12,
      date: "",
      time: "",
      description: "",
    },
  });

  function onSubmit(values: ClassFormValues) {
    setServerError(null);
    startTransition(async () => {
      // On success the action redirects to /classes, so control returns here
      // only when something went wrong.
      const result = await createClass(values);
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
          placeholder="e.g. Scene study intensive"
          aria-invalid={!!errors.title}
          {...register("title")}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="discipline">Discipline</Label>
          <NativeSelect
            id="discipline"
            aria-invalid={!!errors.discipline}
            {...register("discipline")}
          >
            {PROJECT_DISCIPLINES.map((d) => (
              <option key={d} value={d}>
                {disciplineLabel(d)}
              </option>
            ))}
          </NativeSelect>
          {errors.discipline && (
            <p className="text-sm text-destructive">
              {errors.discipline.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="level">Level</Label>
          <NativeSelect
            id="level"
            aria-invalid={!!errors.level}
            {...register("level")}
          >
            {CLASS_LEVELS.map((l) => (
              <option key={l} value={l}>
                {classLevelLabel(l)}
              </option>
            ))}
          </NativeSelect>
          {errors.level && (
            <p className="text-sm text-destructive">{errors.level.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="format">Format</Label>
        <NativeSelect
          id="format"
          aria-invalid={!!errors.format}
          {...register("format")}
        >
          {CLASS_FORMATS.map((f) => (
            <option key={f} value={f}>
              {classFormatLabel(f)}
            </option>
          ))}
        </NativeSelect>
        {errors.format && (
          <p className="text-sm text-destructive">{errors.format.message}</p>
        )}
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Price (USD)</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="1"
            aria-invalid={!!errors.price}
            {...register("price", { valueAsNumber: true })}
          />
          {errors.price && (
            <p className="text-sm text-destructive">{errors.price.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            type="number"
            min="1"
            step="1"
            aria-invalid={!!errors.capacity}
            {...register("capacity", { valueAsNumber: true })}
          />
          {errors.capacity && (
            <p className="text-sm text-destructive">
              {errors.capacity.message}
            </p>
          )}
        </div>
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
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={6}
          placeholder="What you'll cover, who it's for, and what to bring."
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
          onClick={() => router.push("/classes")}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
