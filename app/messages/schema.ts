import { z } from "zod";

/**
 * Validation for a single message body. Shared by the composer (instant
 * feedback) and the server action (never trust the client). Trimmed, non-empty,
 * capped — matching the DB CHECK (length(trim(body)) > 0) in
 * supabase/messages.sql.
 */
export const messageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a message first.")
    .max(2000, "Keep it under 2000 characters."),
});

export type MessageFormValues = z.infer<typeof messageSchema>;
