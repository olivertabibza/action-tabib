import { z } from "zod";

import { EVENT_TYPES } from "@/lib/content";

/**
 * Validation for hosting an event. Shared by the client form (instant feedback)
 * and the server action (never trust the client). `date` + `time` are separate
 * inputs the action combines into the stored `starts_at` timestamp; `venue` may
 * be left blank (an empty venue reads as "Virtual").
 */
export const eventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Please add a title.")
    .max(120, "Keep the title under 120 characters."),
  event_type: z.enum(EVENT_TYPES),
  date: z.string().trim().min(1, "Please pick a date."),
  time: z.string().trim().min(1, "Please pick a start time."),
  venue: z.string().trim().max(120, "Keep the venue under 120 characters."),
  description: z
    .string()
    .trim()
    .min(1, "Please describe the event.")
    .max(2000, "Keep the description under 2000 characters."),
});

export type EventFormValues = z.infer<typeof eventSchema>;
