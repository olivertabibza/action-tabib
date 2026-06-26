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

/** Display label for a stored event_type, e.g. "q_and_a" → "Q&A". */
export function eventTypeLabel(value: string | null | undefined): string {
  return EVENT_TYPE_LABELS[value as EventType] ?? "Event";
}

/** Display label for a stored article category, e.g. "scene_report" → "Scene Report". */
export function articleCategoryLabel(value: string | null | undefined): string {
  return ARTICLE_CATEGORY_LABELS[value as ArticleCategory] ?? "Article";
}
