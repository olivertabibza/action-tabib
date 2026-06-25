import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { FanShell } from "@/components/FanShell";

/**
 * Access gate for the whole Fan (consumer) app, enforced in one place so the
 * pages below don't each repeat it (mirrors app/projects/layout.tsx):
 *   - logged-out         → /login (the proxy also guards /fan/*)
 *   - professional       → /home (their home; this app is consumer-only)
 *   - consumer ("fan")   → render the Fan shell
 *
 * Renders the responsive Fan shell (FanShell): a bottom tab bar on mobile, a
 * left sidebar on desktop — the Fan app is mobile-first responsive web (no
 * native app, no top nav; components/Nav.tsx hides itself on /fan/*).
 */
export default async function FanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.account_type === "professional") {
    redirect("/home");
  }

  return <FanShell>{children}</FanShell>;
}
