import { createClient } from "@/lib/supabase/server";
import { FanShell } from "@/components/FanShell";
import { ProShellServer } from "@/components/ProShellServer";
import { SiteNav } from "@/components/SiteNav";

/**
 * One layout for the pages anyone can open: event and article pages and public
 * profiles (UX B-03, PX F11). Members used to lose their bottom tabs there and
 * land on a second, ☰-menu layout with "Back" as the only way out. Now each
 * viewer stays in their own app:
 *   - approved pros  → ProShell (Feed · Projects · Classes · Explore · …)
 *   - fans           → FanShell (Feed · Explore · Events · Profile)
 *   - everyone else (visitors, pending or rejected pros) → the public top nav
 */
export async function ViewerShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type, application_status")
      .eq("id", user.id)
      .maybeSingle();
    if (
      profile?.account_type === "professional" &&
      profile?.application_status === "approved"
    ) {
      return <ProShellServer>{children}</ProShellServer>;
    }
    if (profile?.account_type === "consumer") {
      return <FanShell>{children}</FanShell>;
    }
  }

  return (
    <>
      <SiteNav />
      {children}
    </>
  );
}
