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
import { createClass, updateClass } from "./actions";

/**
 * Create a class, or — when `edit` is passed — edit an existing one. Edit mode
 * pre-fills the fields, saves through updateClass and cancels back to the class.
 */
export function ClassForm({
  edit,
}: {
  edit?: { classId: string; initialValues: ClassFormValues };
} = {}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: edit?.initialValues ?? {
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
      // On success the action redirects (to /classes, or back to the class when
      // editing), so control returns here only when something went wrong.
      const result = edit
        ? await updateClass(edit.classId, values)
        : await createClass(values);
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
          aria-describedby={errors.title ? "class-title-error" : undefined}
          {...register("title")}
        />
        {errors.title && (
          <p id="class-title-error" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="discipline">Discipline</Label>
          <NativeSelect
            id="discipline"
            aria-invalid={!!errors.discipline}
            aria-describedby={
              errors.discipline ? "class-discipline-error" : undefined
            }
            {...register("discipline")}
          >
            {PROJECT_DISCIPLINES.map((d) => (
              <option key={d} value={d}>
                {disciplineLabel(d)}
              </option>
            ))}
          </NativeSelect>
          {errors.discipline && (
            <p id="class-discipline-error" className="text-sm text-destructive">
              {errors.discipline.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="level">Level</Label>
          <NativeSelect
            id="level"
            aria-invalid={!!errors.level}
            aria-describedby={errors.level ? "class-level-error" : undefined}
            {...register("level")}
          >
            {CLASS_LEVELS.map((l) => (
              <option key={l} value={l}>
                {classLevelLabel(l)}
              </option>
            ))}
          </NativeSelect>
          {errors.level && (
            <p id="class-level-error" className="text-sm text-destructive">
              {errors.level.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="format">Format</Label>
        <NativeSelect
          id="format"
          aria-invalid={!!errors.format}
          aria-describedby={errors.format ? "class-format-error" : undefined}
          {...register("format")}
        >
          {CLASS_FORMATS.map((f) => (
            <option key={f} value={f}>
              {classFormatLabel(f)}
            </option>
          ))}
        </NativeSelect>
        {errors.format && (
          <p id="class-format-error" className="text-sm text-destructive">
            {errors.format.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="venue">Venue</Label>
        <Input
          id="venue"
          placeholder="Leave blank for virtual"
          aria-invalid={!!errors.venue}
          aria-describedby={errors.venue ? "class-venue-error" : undefined}
          {...register("venue")}
        />
        {errors.venue && (
          <p id="class-venue-error" className="text-sm text-destructive">
            {errors.venue.message}
          </p>
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
            aria-describedby={errors.price ? "class-price-error" : undefined}
            {...register("price", { valueAsNumber: true })}
          />
          {errors.price && (
            <p id="class-price-error" className="text-sm text-destructive">
              {errors.price.message}
            </p>
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
            aria-describedby={
              errors.capacity ? "class-capacity-error" : undefined
            }
            {...register("capacity", { valueAsNumber: true })}
          />
          {errors.capacity && (
            <p id="class-capacity-error" className="text-sm text-destructive">
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
            aria-describedby={errors.date ? "class-date-error" : undefined}
            {...register("date")}
          />
          {errors.date && (
            <p id="class-date-error" className="text-sm text-destructive">
              {errors.date.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="time">Start time</Label>
          <Input
            id="time"
            type="time"
            aria-invalid={!!errors.time}
            aria-describedby={errors.time ? "class-time-error" : undefined}
            {...register("time")}
          />
          {errors.time && (
            <p id="class-time-error" className="text-sm text-destructive">
              {errors.time.message}
            </p>
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
          aria-describedby={
            errors.description ? "class-description-error" : undefined
          }
          {...register("description")}
        />
        {errors.description && (
          <p id="class-description-error" className="text-sm text-destructive">
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
          {edit
            ? pending
              ? "Saving…"
              : "Save changes"
            : pending
              ? "Submitting…"
              : "Submit for review"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            router.push(edit ? `/classes/${edit.classId}` : "/classes")
          }
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
