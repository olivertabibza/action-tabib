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
import {
  COMPENSATION,
  PROJECT_DISCIPLINES,
  disciplineLabel,
  titleCase,
} from "@/lib/marketplace";
import { projectSchema, type ProjectFormValues } from "../schema";
import { createProject } from "../actions";

export function ProjectForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "",
      disciplines: [],
      description: "",
      location: "",
      compensation: "unpaid",
    },
  });

  // "Any discipline" is mutually exclusive with the specific ones: checking it
  // clears the rest, and while it's checked the rest are disabled.
  const disciplines = watch("disciplines");
  const anySelected = disciplines.includes("any");

  function toggleDiscipline(value: ProjectFormValues["disciplines"][number]) {
    const next =
      value === "any"
        ? anySelected
          ? []
          : ["any" as const]
        : disciplines.includes(value)
          ? disciplines.filter((d) => d !== value)
          : [...disciplines, value];
    setValue("disciplines", next, { shouldValidate: true });
  }

  function onSubmit(values: ProjectFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await createProject(values);
      if ("id" in result) {
        router.push(`/projects/${result.id}`);
        return;
      }
      setServerError(result.error ?? "Couldn't post the project.");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="e.g. Lead actor for a short film"
          aria-invalid={!!errors.title}
          {...register("title")}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Disciplines</legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {PROJECT_DISCIPLINES.map((d) => {
            const disabled = d !== "any" && anySelected;
            return (
              <label
                key={d}
                className={`inline-flex items-center gap-2 text-sm ${
                  disabled ? "text-muted-foreground opacity-60" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={disciplines.includes(d)}
                  disabled={disabled}
                  onChange={() => toggleDiscipline(d)}
                />
                {disciplineLabel(d)}
              </label>
            );
          })}
        </div>
        {errors.disciplines && (
          <p className="text-sm text-destructive">
            {errors.disciplines.message}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-2 sm:w-56">
        <Label htmlFor="compensation">Compensation</Label>
        <NativeSelect
          id="compensation"
          aria-invalid={!!errors.compensation}
          {...register("compensation")}
        >
          {COMPENSATION.map((c) => (
            <option key={c} value={c}>
              {titleCase(c)}
            </option>
          ))}
        </NativeSelect>
        {errors.compensation && (
          <p className="text-sm text-destructive">
            {errors.compensation.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="e.g. Los Angeles, CA or Remote"
          aria-invalid={!!errors.location}
          {...register("location")}
        />
        {errors.location && (
          <p className="text-sm text-destructive">{errors.location.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={6}
          placeholder="What's the project, who are you looking for, dates, and how to stand out."
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
          {pending ? "Posting…" : "Post project"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/projects")}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
