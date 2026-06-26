import { cn } from "@/lib/utils";

/** Derive 1–2 uppercase initials from a display name, with a "?" fallback. */
export function initialsFrom(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Tiny, dependency-free initials avatar — just a styled circle, no image
 * loading. Shared by the feed, compose box, and Connect suggestions so they all
 * render people the same way. Default size is `size-10`; pass `className` to
 * override (e.g. smaller avatars in the Recommended card's "who took it" row).
 */
export function Avatar({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 select-none items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand",
        className
      )}
    >
      {initialsFrom(name)}
    </span>
  );
}
