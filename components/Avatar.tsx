import { cn } from "@/lib/utils";

/** Derive 1–2 uppercase initials from a display name, with a "?" fallback. */
export function initialsFrom(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Public URL of a profile photo (`profiles.avatar_path`, a file in the public
 * "avatars" bucket — supabase/avatars.sql). Null when there's no photo.
 */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}

/**
 * A person's photo (UX B-01), or their initials in a circle when they haven't
 * added one. Shared by every list, feed and page that shows people, so they all
 * render people the same way. Default size is `size-10`; pass `className` to
 * override. Decorative: the name is always shown next to it.
 */
export function Avatar({
  name,
  photoPath,
  className,
}: {
  name: string | null | undefined;
  /** profiles.avatar_path; omit or null for initials. */
  photoPath?: string | null;
  className?: string;
}) {
  const base =
    "flex size-10 shrink-0 select-none items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand";
  const src = avatarUrl(photoPath);
  if (src) {
    return (
      // Plain <img>: the files are small, already public, and next/image would
      // need the Supabase host configured for nothing gained at this size.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className={cn(base, "object-cover", className)}
      />
    );
  }
  return (
    <span aria-hidden className={cn(base, className)}>
      {initialsFrom(name)}
    </span>
  );
}
