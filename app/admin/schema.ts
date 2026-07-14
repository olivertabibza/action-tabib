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

/**
 * The statuses an admin can set on an event or article. "published" is the
 * approve action, "rejected" turns it down, "pending" re-queues it. Mirrors the
 * content.sql status CHECK (widened in content-review.sql).
 */
export const contentDecisionSchema = z.enum([
  "published",
  "rejected",
  "pending",
]);

export type ContentDecision = z.infer<typeof contentDecisionSchema>;

/** Which content table a decision targets. */
export const contentKindSchema = z.enum(["event", "article", "class"]);

export type ContentKind = z.infer<typeof contentKindSchema>;
