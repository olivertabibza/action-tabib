// Fan Profile (F5) — the fan's own account surface: identity header, how many
// filmmakers they follow, a marketing prompt to upgrade to Pro, and a saved
// items section. No resume/credits — that's Pro-only. Matched to fan-profile.png.
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { LogoutButton } from "@/components/LogoutButton";

export default async function FanProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The fan's own profile row — the self-read RLS policy permits this.
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const name = profile?.display_name || "Your profile";

  // How many filmmakers this fan follows. head + count avoids fetching rows.
  const { count } = user
    ? await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", user.id)
    : { count: 0 };
  const followingCount = count ?? 0;

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      {/* Identity header */}
      <div className="flex flex-col items-start gap-3">
        <Avatar name={name} className="size-20 text-2xl" />
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
            Fan
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {followingCount > 0
            ? `Following ${followingCount} filmmaker${followingCount === 1 ? "" : "s"}`
            : "Not following anyone yet."}
        </p>
      </div>

      {/* Upgrade prompt. Links to /for-creators, the established creator-application
          entry point. NOTE: the real consumer→pro upgrade flow is a separate future
          step; this is currently just the marketing entry. */}
      <div className="mt-6 rounded-xl border border-brand/20 bg-brand/5 p-4">
        <h2 className="font-semibold text-brand">
          You&rsquo;re an industry professional?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upgrade to a professional account to access classes, projects, and
          casting.
        </p>
        <Link
          href="/for-creators"
          className="mt-4 flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
        >
          Apply for a Pro account
        </Link>
      </div>

      {/* Saved section. Placeholder for a future feature — no saved/bookmarks
          table exists yet, so there's nothing to query. */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Saved
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Nothing saved yet — save events and articles to find them here.
      </p>

      {/* Mobile-only logout — desktop has the sidebar control instead. */}
      <LogoutButton className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 md:hidden" />
    </main>
  );
}
