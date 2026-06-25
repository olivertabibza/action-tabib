import { z } from "zod";

/**
 * Validation for a status update. Shared by the compose box (instant feedback)
 * and the server action (never trust the client).
 */
export const statusUpdateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something to share.")
    .max(500, "Keep your update under 500 characters."),
});

export type StatusUpdateValues = z.infer<typeof statusUpdateSchema>;
