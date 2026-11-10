import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { destinationFor } from "@/lib/auth-dispatch";
import { ProShellServer } from "@/components/ProShellServer";

/**
 * Access gate for the whole admin area. Mirrors the marketplace gate in
 * app/projects/layout.tsx: read the current user's profile in one place and
 * send anyone who isn't an admin back to their own app (destinationFor). Every
 * admin Server Action re-checks is_admin too, so this page gate is the first
 * layer, not the only one.
 */
export default async function AdminLayout({
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
    .select("is_admin, account_type, application_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    redirect(destinationFor(profile));
  }

  // UX B-14: admin pages get the app's normal top bar (logo back to the Feed,
  // Log out, Profile) instead of a bare page with no way out.
  return <ProShellServer wide>{children}</ProShellServer>;
}
