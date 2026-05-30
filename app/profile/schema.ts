import { z } from "zod";

/**
 * Shared validation for the editable profile fields. Imported by both the
 * client form (for instant feedback) and the server action (so we never trust
 * the client). `trim()` normalises whitespace before it reaches the database.
 */
export const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Please enter a display name.")
    .max(80, "Keep your display name under 80 characters."),
  headline: z
    .string()
    .trim()
    .max(120, "Keep your headline under 120 characters."),
  bio: z.string().trim().max(600, "Keep your bio under 600 characters."),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
