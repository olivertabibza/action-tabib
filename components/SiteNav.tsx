import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

/**
 * Server wrapper for the global top nav. Reads the session once on the server
 * so <Nav> renders in the correct (logged-in / logged-out) state without a
 * flash. Rendered by the (public) route group layout and the shared /profile
 * layout — never on shell routes (ProShell / FanShell own their own chrome).
 */
export async function SiteNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  let isAdmin = false;
  let isApprovedPro = false;
  let isConsumer = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, is_admin, account_type, application_status")
      .eq("id", user.id)
      .maybeSingle();
    displayName = profile?.display_name || user.email || null;
    isAdmin = !!profile?.is_admin;
    isApprovedPro =
      profile?.account_type === "professional" &&
      profile?.application_status === "approved";
    isConsumer = profile?.account_type === "consumer";
  }

  return (
    <Nav
      authed={!!user}
      displayName={displayName}
      isAdmin={isAdmin}
      isApprovedPro={isApprovedPro}
      isConsumer={isConsumer}
    />
  );
}
