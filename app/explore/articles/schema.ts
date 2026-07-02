import { z } from "zod";

import { ARTICLE_CATEGORIES } from "@/lib/content";

/**
 * Validation for writing an article. Shared by the client form (instant
 * feedback) and the server action (never trust the client).
 */
export const articleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Please add a title.")
    .max(160, "Keep the title under 160 characters."),
  category: z.enum(ARTICLE_CATEGORIES),
  excerpt: z
    .string()
    .trim()
    .min(1, "Please add a short excerpt.")
    .max(300, "Keep the excerpt under 300 characters."),
  body: z
    .string()
    .trim()
    .min(1, "Please write the article.")
    .max(20000, "Keep the article under 20000 characters."),
});

export type ArticleFormValues = z.infer<typeof articleSchema>;
