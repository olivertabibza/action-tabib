"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  COMPENSATION,
  PAY_UNITS,
  PROJECT_DISCIPLINES,
  PROJECT_TYPES,
  ROLE_BILLINGS,
  ROLE_GENDERS,
  disciplineLabel,
  projectTypeLabel,
  titleCase,
} from "@/lib/marketplace";
import {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  emptyRole,
  projectSchema,
  toOptionalInt,
  type ProjectFormValues,
} from "../schema";
import { createProject } from "../actions";

export function ProjectForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The in-progress tag, before Enter turns it into a chip. Local state, not a
  // form field — only committed chips are part of the submitted value.
  const [tagDraft, setTagDraft] = useState("");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "",
      project_type: undefined,
      disciplines: [],
      description: "",
      location: "",
      compensation: "unpaid",
      pay_min: null,
      pay_max: null,
      pay_unit: "day",
      tags: [],
      roles: [],
    },
  });

  const {
    fields: roleFields,
    append: appendRole,
    remove: removeRole,
  } = useFieldArray({ control, name: "roles" });

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

  // Pay only exists for PAID projects. Switching away clears the inputs as
  // well as hiding them, so a value typed and then abandoned is never sent.
  const compensationField = register("compensation");
  const compensation = watch("compensation");
  const showPay = compensation === "paid";

  const tags = watch("tags");

  function addTag() {
    const value = tagDraft.trim().slice(0, MAX_TAG_LENGTH);
    setTagDraft("");
    if (!value || tags.length >= MAX_TAGS) return;
    // Same rule as the server: "Drama" and "drama" are one tag.
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    setValue("tags", [...tags, value], { shouldValidate: true });
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

      <div className="flex flex-col gap-2 sm:w-72">
        <Label htmlFor="project_type">Project type</Label>
        <NativeSelect
          id="project_type"
          defaultValue=""
          aria-invalid={!!errors.project_type}
          {...register("project_type")}
        >
          <option value="" disabled>
            Select a type…
          </option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {projectTypeLabel(t)}
            </option>
          ))}
        </NativeSelect>
        {errors.project_type && (
          <p className="text-sm text-destructive">
            {errors.project_type.message}
          </p>
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
          {...compensationField}
          onChange={(e) => {
            compensationField.onChange(e);
            if (e.target.value !== "paid") {
              setValue("pay_min", null, { shouldValidate: true });
              setValue("pay_max", null, { shouldValidate: true });
            }
          }}
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

      {/* Only paid projects have a pay range; unpaid and deferred ones store
          nulls and render no pay line on the browse card at all. */}
      {showPay && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            Pay range{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </legend>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pay_min" className="text-xs text-muted-foreground">
                Minimum
              </Label>
              <Input
                id="pay_min"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="450"
                className="w-32"
                aria-invalid={!!errors.pay_min}
                {...register("pay_min", { setValueAs: toOptionalInt })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pay_max" className="text-xs text-muted-foreground">
                Maximum
              </Label>
              <Input
                id="pay_max"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="900"
                className="w-32"
                aria-invalid={!!errors.pay_max}
                {...register("pay_max", { setValueAs: toOptionalInt })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pay_unit" className="text-xs text-muted-foreground">
                Per
              </Label>
              <NativeSelect
                id="pay_unit"
                className="w-32"
                {...register("pay_unit")}
              >
                {PAY_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {titleCase(u)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          {(errors.pay_min || errors.pay_max) && (
            <p className="text-sm text-destructive">
              {errors.pay_min?.message ?? errors.pay_max?.message}
            </p>
          )}
        </fieldset>
      )}

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

      {/* ── Tags ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="tag-draft">
          Tags{" "}
          <span className="font-normal text-muted-foreground">
            (optional, up to {MAX_TAGS})
          </span>
        </Label>
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 py-1 pl-3 pr-1.5 text-sm text-brand">
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() =>
                      setValue(
                        "tags",
                        tags.filter((t) => t !== tag),
                        { shouldValidate: true }
                      )
                    }
                    className="rounded-full p-0.5 transition-colors hover:bg-brand/20"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <Input
            id="tag-draft"
            value={tagDraft}
            maxLength={MAX_TAG_LENGTH}
            disabled={tags.length >= MAX_TAGS}
            placeholder={
              tags.length >= MAX_TAGS
                ? `That's all ${MAX_TAGS} tags`
                : "e.g. Night shoot — press Enter"
            }
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter and comma both commit. Enter must not submit the form.
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addTag}
            disabled={tags.length >= MAX_TAGS}
          >
            Add
          </Button>
        </div>
        {errors.tags && (
          <p className="text-sm text-destructive">
            {errors.tags.message ?? "Please check your tags."}
          </p>
        )}
      </div>

      {/* ── Roles ───────────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">
          Open roles{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <p className="text-sm text-muted-foreground">
          Add a row per role you&rsquo;re casting or crewing, and people can
          apply for one specifically. Leave this empty for an open crew call —
          applicants then apply to the production as a whole.
        </p>

        {roleFields.map((field, index) => (
          <div
            key={field.id}
            className="flex flex-col gap-3 rounded-lg border border-border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor={`role-name-${index}`}>Role name</Label>
                <Input
                  id={`role-name-${index}`}
                  placeholder="e.g. Nadia, or Director of Photography"
                  aria-invalid={!!errors.roles?.[index]?.name}
                  {...register(`roles.${index}.name`)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-7"
                aria-label={`Remove role ${index + 1}`}
                onClick={() => removeRole(index)}
              >
                <X className="size-4" />
                Remove
              </Button>
            </div>
            {errors.roles?.[index]?.name && (
              <p className="text-sm text-destructive">
                {errors.roles[index]?.name?.message}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor={`role-billing-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  Billing
                </Label>
                <NativeSelect
                  id={`role-billing-${index}`}
                  className="w-36"
                  {...register(`roles.${index}.billing`)}
                >
                  {ROLE_BILLINGS.map((b) => (
                    <option key={b} value={b}>
                      {titleCase(b)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor={`role-gender-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  Gender
                </Label>
                <NativeSelect
                  id={`role-gender-${index}`}
                  className="w-36"
                  {...register(`roles.${index}.gender`)}
                >
                  {ROLE_GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g === "any"
                        ? "Any"
                        : g === "non-binary"
                          ? "Non-binary"
                          : titleCase(g)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor={`role-age-min-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  Age from
                </Label>
                <Input
                  id={`role-age-min-${index}`}
                  type="number"
                  min={0}
                  max={120}
                  inputMode="numeric"
                  placeholder="—"
                  className="w-24"
                  {...register(`roles.${index}.age_min`, {
                    setValueAs: toOptionalInt,
                  })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor={`role-age-max-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  Age to
                </Label>
                <Input
                  id={`role-age-max-${index}`}
                  type="number"
                  min={0}
                  max={120}
                  inputMode="numeric"
                  placeholder="—"
                  className="w-24"
                  aria-invalid={!!errors.roles?.[index]?.age_max}
                  {...register(`roles.${index}.age_max`, {
                    setValueAs: toOptionalInt,
                  })}
                />
              </div>
            </div>
            {(errors.roles?.[index]?.age_min ||
              errors.roles?.[index]?.age_max) && (
              <p className="text-sm text-destructive">
                {errors.roles[index]?.age_min?.message ??
                  errors.roles[index]?.age_max?.message}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Label
                htmlFor={`role-description-${index}`}
                className="text-xs text-muted-foreground"
              >
                Role description (optional)
              </Label>
              <Textarea
                id={`role-description-${index}`}
                rows={2}
                placeholder="A line or two on who this character or position is."
                aria-invalid={!!errors.roles?.[index]?.description}
                {...register(`roles.${index}.description`)}
              />
              {errors.roles?.[index]?.description && (
                <p className="text-sm text-destructive">
                  {errors.roles[index]?.description?.message}
                </p>
              )}
            </div>
          </div>
        ))}

        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => appendRole(emptyRole)}
          >
            <Plus className="size-4" />
            {roleFields.length === 0 ? "Add a role" : "Add another role"}
          </Button>
        </div>
        {errors.roles?.message && (
          <p className="text-sm text-destructive">{errors.roles.message}</p>
        )}
      </fieldset>

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
