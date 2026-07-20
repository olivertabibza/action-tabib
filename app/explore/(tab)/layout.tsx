import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { destinationFor } from "@/lib/auth-dispatch";
import { ProShell } from "@/components/ProShell";

/**
 * Access gate for the Pro Explore TAB (the index at /explore), enforced in one
 * place (mirrors app/messages/layout.tsx):
 *   - logged-out                   → /login (the proxy also guards this)
 *   - not an approved professional → their own app (destinationFor)
 *   - approved pro                 → render inside the Pro shell
 *
 * This gate is scoped to the `(tab)` route group on purpose: the article and
 * event DETAIL pages (app/explore/articles/[id], app/explore/events/[id]) live
 * OUTSIDE this group so they stay PUBLIC — published content is open-access and
 * logged-out fans must be able to read it.
 */
export default async function ExploreTabLayout({
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
    .select("account_type, application_status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profile?.account_type !== "professional" ||
    profile?.application_status !== "approved"
  ) {
    redirect(destinationFor(profile));
  }

  return <ProShell>{children}</ProShell>;
}
