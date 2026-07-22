import { z } from "zod";

import { PROJECT_DISCIPLINES } from "@/lib/marketplace";
import { CLASS_LEVELS, CLASS_FORMATS } from "@/lib/content";

/**
 * Validation for teaching a class. Shared by the client form (instant feedback)
 * and the server action (never trust the client). `date` + `time` are separate
 * inputs the action combines into the stored `starts_at` timestamp; `price` is
 * entered in DOLLARS and converted to `price_cents` on submit. `venue` may be
 * blank (a virtual class reads its location from the format). Mirrors the event
 * schema (app/explore/events/schema.ts).
 */
export const classSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Please add a title.")
    .max(120, "Keep the title under 120 characters."),
  discipline: z.enum(PROJECT_DISCIPLINES),
  format: z.enum(CLASS_FORMATS),
  level: z.enum(CLASS_LEVELS),
  venue: z.string().trim().max(120, "Keep the venue under 120 characters."),
  // The form registers these with valueAsNumber, so they arrive as numbers
  // (an empty input becomes NaN, which fails the type check with the message).
  price: z
    .number({ error: "Enter a price (0 for free)." })
    .min(0, "Price can't be negative.")
    .max(100000, "That price looks too high."),
  capacity: z
    .number({ error: "Enter a capacity." })
    .int("Capacity must be a whole number.")
    .min(1, "Allow at least one seat.")
    .max(1000, "That capacity looks too high."),
  date: z.string().trim().min(1, "Please pick a date."),
  time: z.string().trim().min(1, "Please pick a start time."),
  description: z
    .string()
    .trim()
    .min(1, "Please describe the class.")
    .max(2000, "Keep the description under 2000 characters."),
});

export type ClassFormValues = z.infer<typeof classSchema>;

/**
 * Validation for a class review. The star picker supplies the rating; the body
 * is optional (a star-only review is fine). RLS separately enforces WHO may
 * review (enrolled, approved pro); this only checks the values.
 */
export const reviewSchema = z.object({
  rating: z
    .number({ error: "Pick a star rating." })
    .int()
    .min(1, "Pick a star rating.")
    .max(5, "Ratings go up to 5 stars."),
  body: z
    .string()
    .trim()
    .max(1000, "Keep the review under 1000 characters."),
});

export type ReviewFormValues = z.infer<typeof reviewSchema>;
