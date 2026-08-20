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

/**
 * The eight project_type values (supabase/project-roles.sql §1) — the design's
 * seven category chips plus 'other', which exists so the column's default is a
 * no-op for rows that predate that file. 'other' is deliberately absent from
 * the chip row on /projects.
 */
export const PROJECT_TYPES = [
  "short_film",
  "feature_film",
  "web_series",
  "music_video",
  "commercial",
  "documentary",
  "crew_call",
  "other",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  short_film: "Short film",
  feature_film: "Feature film",
  web_series: "Web series",
  music_video: "Music video",
  commercial: "Commercial",
  documentary: "Documentary",
  crew_call: "Crew call",
  other: "Other",
};

export function projectTypeLabel(value: string | null | undefined): string {
  return PROJECT_TYPE_LABELS[value as ProjectType] ?? "Other";
}

export const PAY_UNITS = ["hour", "day", "week", "project"] as const;
export type PayUnit = (typeof PAY_UNITS)[number];

/** project_roles.billing / .gender vocabularies (supabase/project-roles.sql §3). */
export const ROLE_BILLINGS = ["lead", "supporting", "background", "crew"] as const;
export const ROLE_GENDERS = ["any", "female", "male", "non-binary"] as const;

const GENDER_LABELS: Record<string, string> = {
  female: "Female",
  male: "Male",
  "non-binary": "Non-binary",
};

/**
 * The card's pay line: "$450–$900 / day". Returns null when BOTH bounds are
 * null — unpaid and deferred projects have no pay range, and the design shows
 * no pay line at all for those rather than a placeholder.
 */
export function formatPayRange(
  min: number | null | undefined,
  max: number | null | undefined,
  unit: string | null | undefined
): string | null {
  if (min == null && max == null) return null;
  const money = (n: number) => `$${n.toLocaleString()}`;
  const per = unit ? ` / ${unit}` : "";
  if (min != null && max != null) {
    return min === max ? `${money(min)}${per}` : `${money(min)}–${money(max)}${per}`;
  }
  if (min != null) return `From ${money(min)}${per}`;
  return `Up to ${money(max!)}${per}`;
}

/**
 * The role rail's qualifier line, composed at the UI layer from billing +
 * gender + age range — there is deliberately no denormalised string in the
 * database to drift out of sync. Absent parts are skipped: a crew role has no
 * age range, and gender 'any' prints nothing rather than "Any".
 */
export function roleQualifier(role: {
  billing: string;
  gender: string;
  age_min: number | null;
  age_max: number | null;
}): string {
  const parts = [titleCase(role.billing)];
  if (role.gender && role.gender !== "any") {
    parts.push(GENDER_LABELS[role.gender] ?? titleCase(role.gender));
  }
  const { age_min: lo, age_max: hi } = role;
  if (lo != null && hi != null) parts.push(lo === hi ? `${lo}` : `${lo}–${hi}`);
  else if (lo != null) parts.push(`${lo}+`);
  else if (hi != null) parts.push(`Up to ${hi}`);
  return parts.join(" · ");
}

/**
 * Age brackets for the /projects Age filter. `project_roles` stores an open
 * range per role, so a band matches when the two ranges OVERLAP; a null bound
 * on the role means "unbounded on that side".
 */
export const AGE_BANDS = [
  { value: "under-18", label: "Under 18", min: 0, max: 17 },
  { value: "18-24", label: "18–24", min: 18, max: 24 },
  { value: "25-34", label: "25–34", min: 25, max: 34 },
  { value: "35-49", label: "35–49", min: 35, max: 49 },
  { value: "50-plus", label: "50+", min: 50, max: 200 },
] as const;
