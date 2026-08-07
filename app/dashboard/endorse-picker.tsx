"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { toggleEndorsement } from "./actions";
import { FeedAction } from "./feed-action";

export type EndorsableSkill = { value: string; label: string };

type EndorseContextValue = {
  open: boolean;
  endorsedAny: boolean;
  toggleOpen: () => void;
};

/**
 * Endorse is an INLINE DISCLOSURE, not a popover: this repo has no popover /
 * dropdown-menu / dialog component, and adding one via the shadcn CLI drags in
 * the bg-accent → bg-surface-sunken remap chore (docs/DECISIONS.md).
 *
 * The trigger has to sit inside the action bar, which CommentThread owns, while
 * the panel has to render below that bar — so the two halves are separate
 * elements sharing one state through this context rather than one element in
 * two places. Server-rendered action-bar children still reach the provider,
 * since context follows the rendered tree, not where the JSX was authored.
 */
const EndorseContext = createContext<EndorseContextValue | null>(null);

/** The action-bar trigger. Renders nothing without a provider above it, which
 * is how posts whose author lists no endorsable skill drop the action. */
export function EndorseAction({ className }: { className?: string }) {
  const endorse = useContext(EndorseContext);
  if (!endorse) return null;
  return (
    <FeedAction
      interactive
      active={endorse.endorsedAny}
      aria-expanded={endorse.open}
      onClick={endorse.toggleOpen}
      className={className}
    >
      <BadgeCheck className="size-[17px]" strokeWidth={1.5} />
      Endorse
    </FeedAction>
  );
}

/**
 * Wraps a post's action bar and renders the skill picker beneath it. Each skill
 * string is sent to the server exactly as the profile stores it — see
 * toggleEndorsement for why it must not be normalised.
 */
export function EndorsePicker({
  subjectId,
  skills,
  endorsed,
  children,
}: {
  subjectId: string;
  skills: EndorsableSkill[];
  endorsed: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState(() => new Set(endorsed));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Nothing to endorse (no listed skills, or the viewer's own post): render the
  // bar untouched, and EndorseAction finds no provider and drops the action.
  if (skills.length === 0) return <>{children}</>;

  function toggleSkill(skill: string) {
    const on = !mine.has(skill);
    setBusy(skill);
    setError(null);
    startTransition(async () => {
      const result = await toggleEndorsement(subjectId, skill, on);
      if (result.error) {
        setError(result.error);
      } else {
        setMine((prev) => {
          const next = new Set(prev);
          if (on) next.add(skill);
          else next.delete(skill);
          return next;
        });
        router.refresh();
      }
      setBusy(null);
    });
  }

  return (
    <EndorseContext.Provider
      value={{
        open,
        endorsedAny: mine.size > 0,
        toggleOpen: () => setOpen((v) => !v),
      }}
    >
      {children}
      {open && (
        <div className="border-t border-border-hairline bg-surface-sunken px-4 py-3.5">
          <p className="font-condensed text-base font-semibold text-text-primary">
            Endorse for
          </p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {skills.map((skill) => {
              const on = mine.has(skill.value);
              return (
                <li
                  key={skill.value}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate text-[14.5px] text-text-secondary">
                    {skill.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSkill(skill.value)}
                    disabled={busy !== null}
                    className={cn(
                      "focus-ring flex shrink-0 items-center gap-1.5 rounded-full px-[18px] py-[7px] text-[13.5px] font-semibold transition-[background-color,opacity] disabled:opacity-60",
                      on
                        ? "bg-accent-tint text-accent hover:opacity-80"
                        : "border-[1.5px] border-accent text-accent hover:bg-accent-tint"
                    )}
                  >
                    {busy === skill.value && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    {on ? "Endorsed" : "Endorse"}
                  </button>
                </li>
              );
            })}
          </ul>
          {error && (
            <p
              role="alert"
              className="mt-2.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </EndorseContext.Provider>
  );
}
