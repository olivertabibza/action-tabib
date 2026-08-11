import { createClient } from "@/lib/supabase/server";

/**
 * Badge counts for the app-chrome nav items (README `nav.counts`). Only
 * `network` is a real read so far — incoming pending connection requests, the
 * badge that makes a request discoverable below 1180px where the feed's right
 * rail is hidden. `projects`, `classes` and `messages` stay at 0 until each
 * gets its own task; do not invent counts for them here.
 *
 * Called once per render, from components/ProShellServer.tsx — not per layout.
 * Returns zeros (never throws) when there is no session, so it stays safe to
 * call from any shell, including one a logged-out user hits mid-redirect.
 */
export type NavCounts = {
  projects: number;
  classes: number;
  network: number;
  messages: number;
};

const ZERO: NavCounts = { projects: 0, classes: 0, network: 0, messages: 0 };

export async function getNavCounts(): Promise<NavCounts> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return ZERO;

  // "Parties read own connections" covers this — the viewer is the addressee
  // of every row counted, so no RPC is needed.
  const { count } = await supabase
    .from("connections")
    .select("*", { count: "exact", head: true })
    .eq("addressee_id", user.id)
    .eq("status", "pending");

  return { ...ZERO, network: count ?? 0 };
}
