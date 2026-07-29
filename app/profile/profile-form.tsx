"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { DISCIPLINES, disciplineLabel } from "@/lib/marketplace";
import { profileSchema, type ProfileFormValues } from "./schema";
import { updateProfile } from "./actions";

/**
 * Read view + edit form for the user's display name, headline, and bio.
 * Starts in a read-only state; the "Edit profile" button swaps in a
 * React Hook Form + Zod form that saves through the `updateProfile` action.
 * `showSkills` gates the skills picker to professionals.
 */
export function ProfileForm({
  initial,
  showSkills,
}: {
  initial: ProfileFormValues;
  showSkills: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: current,
  });

  const skills = watch("skills");

  function toggleSkill(value: ProfileFormValues["skills"][number]) {
    const next = skills.includes(value)
      ? skills.filter((s) => s !== value)
      : [...skills, value];
    setValue("skills", next, { shouldValidate: true });
  }

  function startEditing() {
    setServerError(null);
    reset(current);
    setEditing(true);
  }

  function cancelEditing() {
    setServerError(null);
    reset(current);
    setEditing(false);
  }

  function onSubmit(values: ProfileFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateProfile(values);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      setCurrent(values);
      setEditing(false);
      // Re-run server components (e.g. the nav greeting + home page).
      router.refresh();
    });
  }

  // Standard discipline options, plus any legacy onboarding role the user
  // already has so editing other fields never silently wipes it.
  const roleOptions = [...DISCIPLINES] as string[];
  const currentRole = current.role.trim();
  if (currentRole && !roleOptions.includes(currentRole.toLowerCase())) {
    roleOptions.unshift(currentRole);
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-6">
        <ReadField label="Display name" value={current.display_name} />
        <ReadField label="Role" value={disciplineLabel(current.role)} />
        <ReadField label="Headline" value={current.headline} />
        <ReadField label="Bio" value={current.bio} multiline />
        {showSkills && (
          <ReadField
            label="Skills"
            value={current.skills.map(disciplineLabel).join(", ")}
          />
        )}
        <div>
          <Button type="button" variant="outline" onClick={startEditing}>
            <Pencil className="size-4" />
            Edit profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          placeholder="e.g. Jane Doe"
          aria-invalid={!!errors.display_name}
          {...register("display_name")}
        />
        {errors.display_name && (
          <p className="text-sm text-destructive">
            {errors.display_name.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Role</Label>
        <NativeSelect
          id="role"
          aria-invalid={!!errors.role}
          {...register("role")}
        >
          <option value="">Select your role</option>
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {disciplineLabel(r)}
            </option>
          ))}
        </NativeSelect>
        {errors.role && (
          <p className="text-sm text-destructive">{errors.role.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          placeholder="e.g. Director / Screenwriter"
          aria-invalid={!!errors.headline}
          {...register("headline")}
        />
        {errors.headline && (
          <p className="text-sm text-destructive">{errors.headline.message}</p>
        )}
      </div>

      {showSkills && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            Skills — other roles you can work
          </legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {DISCIPLINES.map((d) => (
              <label
                key={d}
                className="inline-flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={skills.includes(d)}
                  onChange={() => toggleSkill(d)}
                />
                {disciplineLabel(d)}
              </label>
            ))}
          </div>
          {errors.skills && (
            <p className="text-sm text-destructive">{errors.skills.message}</p>
          )}
        </fieldset>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          rows={4}
          placeholder="A short introduction — what you do and what you're working on."
          aria-invalid={!!errors.bio}
          {...register("bio")}
        />
        {errors.bio && (
          <p className="text-sm text-destructive">{errors.bio.message}</p>
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
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={cancelEditing}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ReadField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {value ? (
        <p className={multiline ? "mt-1 whitespace-pre-wrap" : "mt-1"}>
          {value}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground italic">Not set yet</p>
      )}
    </div>
  );
}
