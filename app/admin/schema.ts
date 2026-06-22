import { z } from "zod";

/**
 * The application states an admin can set on a professional's profile.
 * "pending" lets an admin undo a decision and send someone back to the queue.
 */
export const applicationDecisionSchema = z.enum([
  "approved",
  "rejected",
  "pending",
]);

export type ApplicationDecision = z.infer<typeof applicationDecisionSchema>;
