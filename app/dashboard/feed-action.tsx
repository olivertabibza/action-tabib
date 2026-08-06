import { cn } from "@/lib/utils";

/**
 * One equal-width target in a post card's action bar (Congratulate · Comment ·
 * Endorse · Share). Shared by the server-rendered static actions in page.tsx
 * and the live Comment toggle in comment-thread.tsx so the bar styles once.
 * Non-interactive actions (everything but Comment until Phase 3b) render
 * aria-disabled and unfocusable but keep the design's resting look.
 */
export function FeedAction({
  active = false,
  interactive = false,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  active?: boolean;
  interactive?: boolean;
}) {
  return (
    <button
      type="button"
      {...(interactive ? {} : { "aria-disabled": true, tabIndex: -1 })}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-action py-2.5 text-sm font-semibold",
        active ? "text-accent" : "text-text-secondary",
        interactive
          ? "focus-ring transition-colors hover:bg-surface-sunken"
          : "pointer-events-none",
        className
      )}
      {...props}
    />
  );
}
