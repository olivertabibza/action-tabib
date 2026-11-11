import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** What an admin review reason is about (supabase/review-reasons.sql). */
export type ReviewItemType = "profile" | "class" | "event" | "article";

/** The longest reason an admin can give (review_reasons' CHECK). */
export const MAX_REVIEW_REASON = 500;

/**
 * Reasons for a set of reviewed items, by item id. RLS returns only rows the
 * caller may read: their own (as the applicant or author) or, for admins, all.
 */
export async function reviewReasons(
  supabase: SupabaseServerClient,
  itemType: ReviewItemType,
  itemIds: string[]
): Promise<Map<string, string>> {
  if (itemIds.length === 0) return new Map();
  const { data } = await supabase
    .from("review_reasons")
    .select("item_id, reason")
    .eq("item_type", itemType)
    .in("item_id", itemIds);
  return new Map(
    (data ?? []).map((r) => [r.item_id as string, r.reason as string])
  );
}
