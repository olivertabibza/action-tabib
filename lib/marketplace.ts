/**
 * Shared marketplace vocabulary. Kept in one place so the project form, the
 * filters, the profile role picker, and the SQL CHECK constraints can't drift
 * apart. These string values are written straight to the database.
 */

export const DISCIPLINES = [
  "actor",
  "writer",
  "director",
  "producer",
  "cinematographer",
  "editor",
  "composer",
  "videographer",
  "sound_designer",
  "sound_operator",
  "costume_designer",
  "makeup_artist",
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

// Projects can also target "any" discipline; profiles cannot.
export const PROJECT_DISCIPLINES = [...DISCIPLINES, "any"] as const;

export const COMPENSATION = ["paid", "unpaid", "deferred"] as const;
export type Compensation = (typeof COMPENSATION)[number];

/** Title-case a stored value like "actor" → "Actor" for display. */
export function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Display label for a discipline value: splits on underscores so
 * "makeup_artist" → "Makeup Artist", with "any" → "Any discipline".
 * Use this (not titleCase) for anything holding a discipline.
 */
export function disciplineLabel(value: string | null | undefined): string {
  if (!value) return "";
  if (value === "any") return "Any discipline";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
