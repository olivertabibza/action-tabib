"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * One row from public.global_search(q text) — see supabase/search.sql. The five
 * columns match the function's returned TABLE exactly; every entity type shares
 * this shape so a single UI can render all of them.
 */
export type SearchResult = {
  kind: "profile" | "project" | "class" | "event" | "article";
  id: string;
  title: string;
  subtitle: string;
  snippet: string;
};

/**
 * Global search across profiles, events, articles and (for approved pros only)
 * projects and classes.
 *
 * The pro gate lives INSIDE the security-definer function, not here: a fan or
 * anon caller physically cannot get project/class rows back, so the UI never
 * branches on account type. We use the normal server client — the definer
 * function is the whole elevated-read story, no service-role key involved.
 */
export async function globalSearch(query: string) {
  const term = query.trim();

  // Mirror the function's own `length(term) >= 2` guard so a 1-character query
  // doesn't cost a round-trip to return zero rows.
  if (term.length < 2) return { results: [] as SearchResult[] };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("global_search", { q: term });

  if (error) {
    // Don't leak the raw Postgres error to the client.
    console.error("global_search failed:", error);
    return { results: [] as SearchResult[], error: "Search failed. Try again." };
  }

  return { results: (data ?? []) as SearchResult[] };
}
