"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Heart, Loader2, Paperclip, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

type Step = "choose" | "professional" | "consumer";

const ROLES = [
  "Actor",
  "Director",
  "Writer",
  "Producer",
  "Cinematographer",
  "Editor",
  "Composer",
  "Sound Designer",
  "Boom Operator",
  "Production Designer",
  "Costume Designer",
  "Makeup Artist",
  "Casting Director",
  "Script Supervisor",
  "Stunt Coordinator",
  "Visual Effects Artist",
  "Other",
] as const;

type ConsumerType =
  | "film_fan"
  | "cinephile"
  | "film_student"
  | "industry_adjacent";

const CONSUMER_OPTIONS: {
  value: ConsumerType;
  emoji: string;
  title: string;
  description: string;
}[] = [
  {
    value: "film_fan",
    emoji: "🎬",
    title: "Film Fan",
    description: "I watch everything I can get my hands on",
  },
  {
    value: "cinephile",
    emoji: "🎞️",
    title: "Cinephile",
    description: "Film is my passion and my obsession",
  },
  {
    value: "film_student",
    emoji: "🎓",
    title: "Film Student",
    description: "I'm studying the craft",
  },
  {
    value: "industry_adjacent",
    emoji: "🎭",
    title: "Industry Adjacent",
    description: "I work near the industry but not in production",
  },
];

export function OnboardingFlow({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [step, setStep] = useState<Step>("choose");

  return (
    <div className="w-full max-w-3xl">
      {step === "choose" && <ChooseStep onSelect={setStep} />}
      {step === "professional" && (
        <ProfessionalStep
          userId={userId}
          email={email}
          onBack={() => setStep("choose")}
        />
      )}
      {step === "consumer" && (
        <ConsumerStep
          userId={userId}
          email={email}
          onBack={() => setStep("choose")}
        />
      )}
    </div>
  );
}

function StepHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-3 text-lg text-muted-foreground text-balance">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ── Step 1 — Who are you? ─────────────────────────────────────────────── */

function ChooseStep({ onSelect }: { onSelect: (step: Step) => void }) {
  const cards = [
    {
      step: "professional" as const,
      icon: Clapperboard,
      heading: "I work in film",
      description:
        "Actors, directors, writers, producers, cinematographers, editors, composers, and crew. Apply to join our curated community.",
    },
    {
      step: "consumer" as const,
      icon: Heart,
      heading: "I love film",
      description:
        "Follow indie creators, discover projects, and stay connected to the independent film world.",
    },
  ];

  return (
    <>
      <StepHeader title="Who are you?" />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ step, icon: Icon, heading, description }) => (
          <button
            key={step}
            type="button"
            onClick={() => onSelect(step)}
            className={cn(
              "group flex flex-col items-start gap-4 rounded-xl bg-card p-6 text-left ring-1 ring-foreground/10 transition-all",
              "hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-lg bg-brand/10 text-brand transition-colors group-hover:bg-brand/15">
              <Icon className="size-6" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-xl font-semibold">{heading}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

/* ── Step 2a — Industry Professional ───────────────────────────────────── */

function ProfessionalStep({
  userId,
  email,
  onBack,
}: {
  userId: string;
  email: string;
  onBack: () => void;
}) {
  const router = useRouter();

  // `roleValue` tracks the highlighted/selected preset (for the check
  // indicator); `roleText` is the source of truth we store — it holds either a
  // chosen preset or a freely typed custom role.
  const [roleValue, setRoleValue] = useState<string | null>(null);
  const [roleText, setRoleText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const role = roleText.trim();
    if (!role) {
      setError("Please select or type your role.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      const portfolioPaths: string[] = [];

      for (const file of files) {
        const path = `${userId}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("portfolios")
          .upload(path, file, { upsert: true });

        if (uploadError) throw uploadError;
        portfolioPaths.push(path);
      }

      const { error: insertError } = await supabase.from("profiles").insert({
        id: userId,
        email,
        account_type: "professional",
        application_status: "pending",
        role,
        portfolio_files: portfolioPaths,
        created_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      router.push("/home");
    } catch (err) {
      console.error(
        "[onboarding] Professional application failed:",
        JSON.stringify(err),
        err
      );
      setError(
        "Something went wrong submitting your application. Please try again."
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <StepHeader
        title="Tell us about your work"
        subtitle="We review every application personally. Share a bit about what you do."
      />

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-xl flex-col gap-6 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="role">What&rsquo;s your role?</Label>
          <Combobox
            items={ROLES}
            value={roleValue}
            onValueChange={setRoleValue}
            inputValue={roleText}
            onInputValueChange={setRoleText}
          >
            <ComboboxInput
              id="role"
              placeholder="Select or type your role"
              autoComplete="off"
            />
            <ComboboxContent>
              <ComboboxEmpty>
                Press Enter to use &ldquo;{roleText}&rdquo;.
              </ComboboxEmpty>
              <ComboboxList>
                {(role: string) => (
                  <ComboboxItem key={role} value={role}>
                    {role}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="portfolio">
            Portfolio, resume, reel, or style book (optional)
          </Label>
          <input
            id="portfolio"
            type="file"
            multiple
            accept=".pdf,.doc,.docx,video/*,image/*"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="flex w-full rounded-lg border border-input bg-transparent text-sm text-muted-foreground transition-colors outline-none file:mr-3 file:cursor-pointer file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />

          {files.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1.5">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm"
                >
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    aria-label={`Remove ${file.name}`}
                    className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={submitting}
          >
            Back
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="h-11 px-6 text-base"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Submitting…" : "Submit Application"}
          </Button>
        </div>
      </form>
    </>
  );
}

/* ── Step 2b — Consumer ────────────────────────────────────────────────── */

function ConsumerStep({
  userId,
  email,
  onBack,
}: {
  userId: string;
  email: string;
  onBack: () => void;
}) {
  const router = useRouter();

  const [selected, setSelected] = useState<ConsumerType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!selected) {
      setError("Pick the option that fits you best.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      const { error: insertError } = await supabase.from("profiles").insert({
        id: userId,
        email,
        account_type: "consumer",
        consumer_type: selected,
        created_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      router.push("/home");
    } catch (err) {
      console.error(
        "[onboarding] Consumer signup failed:",
        JSON.stringify(err),
        err
      );
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <StepHeader title="How would you describe yourself?" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {CONSUMER_OPTIONS.map(({ value, emoji, title, description }) => {
            const isActive = selected === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSelected(value)}
                aria-pressed={isActive}
                className={cn(
                  "flex items-start gap-4 rounded-xl bg-card p-5 text-left ring-1 ring-foreground/10 transition-all",
                  "hover:ring-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
                  isActive && "ring-2 ring-brand"
                )}
              >
                <span className="text-3xl leading-none" aria-hidden>
                  {emoji}
                </span>
                <div>
                  <h2 className="font-semibold">{title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={submitting}
          >
            Back
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="h-11 px-6 text-base"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Joining…" : "Join Now"}
          </Button>
        </div>
      </form>
    </>
  );
}
