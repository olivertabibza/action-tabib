import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { viewerTimeZone } from "@/lib/datetime";
import { loadSavedItems, SavedList } from "@/app/explore/saved/saved-list";
import { ProfileTabs } from "../profile-tabs";

export const metadata: Metadata = { title: "Saved" };

/**
 * Everything an approved pro has saved: projects, events and articles,
 * newest-first (PX F03). Before this, the Profile stat counted saves but there
 * was nowhere to see them. Gated like /profile/network: logged out → /login,
 * anyone but an approved pro → /profile (fans' saves live on /fan/profile).
 */
export default async function ProfileSavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("account_type, application_status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    me?.account_type !== "professional" ||
    me?.application_status !== "approved"
  ) {
    redirect("/profile");
  }

  const items = await loadSavedItems(supabase, user.id, await viewerTimeZone());

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <ProfileTabs active="saved" />
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Saved</h1>
      <p className="mt-2 text-muted-foreground">
        Projects, events and articles you&rsquo;ve bookmarked.
      </p>
      <div className="mt-6">
        <SavedList
          items={items}
          empty="Nothing saved yet. Tap the bookmark on a project, event or article to keep it here."
        />
      </div>
    </main>
  );
}
