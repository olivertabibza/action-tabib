import { z } from "zod";

import { COMPENSATION, PROJECT_DISCIPLINES } from "@/lib/marketplace";

/**
 * Validation for posting a project. Shared by the client form (instant
 * feedback) and the server action (never trust the client).
 */
export const projectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Please add a title.")
    .max(120, "Keep the title under 120 characters."),
  disciplines: z
    .array(z.enum(PROJECT_DISCIPLINES))
    .min(1, "Pick at least one discipline."),
  description: z
    .string()
    .trim()
    .min(1, "Please describe the project.")
    .max(2000, "Keep the description under 2000 characters."),
  location: z
    .string()
    .trim()
    .min(1, "Please add a location.")
    .max(120, "Keep the location under 120 characters."),
  compensation: z.enum(COMPENSATION),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;

/** Validation for applying to a project. The note may be left blank. */
export const applicationSchema = z.object({
  note: z.string().trim().max(1000, "Keep your note under 1000 characters."),
});

export type ApplicationFormValues = z.infer<typeof applicationSchema>;
