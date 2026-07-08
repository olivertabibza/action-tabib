import { createClient } from "@/lib/supabase/server";
import { ProShell } from "@/components/ProShell";

/**
 * /profile is a SHARED, partly-public surface, so the Pro shell is applied
 * CONDITIONALLY by account type — never unconditionally, and with NO redirects:
 *   - approved pros edit their profile here and reach it from the Pro shell tab
 *     bar, so they keep the shell (sidebar + bottom tabs).
 *   - consumers reach /profile from the global top nav, and /profile/[id] is
 *     publicly viewable by anon visitors — both keep the top-nav experience.
 *
 * The session + profile read mirrors app/dashboard/layout.tsx, but without its
 * gate: /profile/[id] must stay reachable by anon users and consumers must keep
 * access to /profile. The matching top-nav hide for approved pros lives in
 * components/Nav.tsx (so the top nav and shell sidebar don't stack).
 */
export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isApprovedPro = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type, application_status")
      .eq("id", user.id)
      .maybeSingle();
    isApprovedPro =
      profile?.account_type === "professional" &&
      profile?.application_status === "approved";
  }

  if (isApprovedPro) {
    return <ProShell>{children}</ProShell>;
  }
  return <>{children}</>;
}
