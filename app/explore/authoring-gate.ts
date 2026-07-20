import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { destinationFor } from "@/lib/auth-dispatch";

/**
 * Access gate for the Pro-only authoring pages (/explore/events/new,
 * /explore/articles/new). These live OUTSIDE the (tab) route group — alongside
 * the PUBLIC detail pages — so they can't lean on the (tab) layout and must gate
 * themselves. Mirrors that layout's rule: logged-out → /login, anyone who isn't
 * an approved professional → their own app (destinationFor). Returns the
 * caller's user id on success.
 */
export async function requireApprovedProPage(): Promise<string> {
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

  return user.id;
}
