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
