/**
 * Shared content vocabulary for events and articles. Kept in one place (like
 * lib/marketplace.ts) so the Explore screens and the SQL CHECK constraints in
 * supabase/content.sql can't drift apart. These string values are written
 * straight to the database.
 */

export const EVENT_TYPES = [
  "screening",
  "q_and_a",
  "panel",
  "festival",
  "mixer",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const ARTICLE_CATEGORIES = [
  "interview",
  "craft",
  "scene_report",
  "news",
] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  screening: "Screening",
  q_and_a: "Q&A",
  panel: "Panel",
  festival: "Festival",
  mixer: "Mixer",
};

const ARTICLE_CATEGORY_LABELS: Record<ArticleCategory, string> = {
  interview: "Interview",
  craft: "Craft",
  scene_report: "Scene Report",
  news: "News",
};

// Class vocabulary — kept here alongside events/articles so the class form, the
// Classes screens, and the SQL CHECK constraints in supabase/classes.sql can't
// drift apart. (discipline reuses the marketplace vocabulary in lib/marketplace.)
export const CLASS_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "all",
] as const;
export type ClassLevel = (typeof CLASS_LEVELS)[number];

export const CLASS_FORMATS = ["in_person", "virtual"] as const;
export type ClassFormat = (typeof CLASS_FORMATS)[number];

const CLASS_LEVEL_LABELS: Record<ClassLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  all: "All levels",
};

const CLASS_FORMAT_LABELS: Record<ClassFormat, string> = {
  in_person: "In person",
  virtual: "Virtual",
};

/** Display label for a stored class level, e.g. "all" → "All levels". */
export function classLevelLabel(value: string | null | undefined): string {
  return CLASS_LEVEL_LABELS[value as ClassLevel] ?? "All levels";
}

/** Display label for a stored class format, e.g. "in_person" → "In person". */
export function classFormatLabel(value: string | null | undefined): string {
  return CLASS_FORMAT_LABELS[value as ClassFormat] ?? "In person";
}

/** Format a price in cents for display; 0 reads as "Free" (enrolling is free). */
export function formatPrice(cents: number | null | undefined): string {
  const c = cents ?? 0;
  if (c <= 0) return "Free";
  const dollars = c / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

/** Display label for a stored event_type, e.g. "q_and_a" → "Q&A". */
export function eventTypeLabel(value: string | null | undefined): string {
  return EVENT_TYPE_LABELS[value as EventType] ?? "Event";
}

/** Display label for a stored article category, e.g. "scene_report" → "Scene Report". */
export function articleCategoryLabel(value: string | null | undefined): string {
  return ARTICLE_CATEGORY_LABELS[value as ArticleCategory] ?? "Article";
}
