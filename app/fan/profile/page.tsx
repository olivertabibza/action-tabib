// Fan Profile (F5) — the fan's own account surface: identity header, how many
// filmmakers they follow, a marketing prompt to upgrade to Pro, and a saved
// items section. No resume/credits — that's Pro-only. Matched to fan-profile.png.
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { LogoutButton } from "@/components/LogoutButton";

// The polymorphic saved rows and the two title-lookup shapes they resolve to.
type SavedRow = { item_type: "event" | "article"; item_id: string };
type EventLookup = { id: string; title: string; starts_at: string };
type ArticleLookup = { id: string; title: string; body: string | null };

// "Fri 12th" — short weekday + ordinal day, matching the mockup's subtitle.
function formatSavedDate(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${weekday} ${day}${suffix}`;
}

// Rough read time from body length at ~200 words/min, floored at 1 minute.
function readingMinutes(body: string | null): number {
  const words = (body ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

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

  // Saved events + articles, newest-first. The rows only carry item_type +
  // item_id, so we fetch the titles in two batched follow-up queries and stitch
  // them back in the saved-at order. RLS scopes this to the caller's own saves.
  const { data: savedRows } = user
    ? await supabase
        .from("saved_items")
        .select("item_type, item_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] as SavedRow[] };
  const saved = (savedRows ?? []) as SavedRow[];

  const eventIds = saved.filter((s) => s.item_type === "event").map((s) => s.item_id);
  const articleIds = saved.filter((s) => s.item_type === "article").map((s) => s.item_id);

  const [{ data: eventData }, { data: articleData }] = await Promise.all([
    eventIds.length
      ? supabase.from("events").select("id, title, starts_at").in("id", eventIds)
      : Promise.resolve({ data: [] as EventLookup[] }),
    articleIds.length
      ? supabase.from("articles").select("id, title, body").in("id", articleIds)
      : Promise.resolve({ data: [] as ArticleLookup[] }),
  ]);
  const eventById = new Map(
    ((eventData ?? []) as EventLookup[]).map((e) => [e.id, e])
  );
  const articleById = new Map(
    ((articleData ?? []) as ArticleLookup[]).map((a) => [a.id, a])
  );

  // Stitch back in saved-at order, dropping any save whose item is gone. Each
  // entry carries just what the row renders: link, title, and a subtitle line.
  const savedItems = saved.flatMap((s) => {
    if (s.item_type === "event") {
      const e = eventById.get(s.item_id);
      if (!e) return [];
      return [
        {
          key: `event-${s.item_id}`,
          href: `/explore/events/${s.item_id}`,
          title: e.title,
          subtitle: `Event · ${formatSavedDate(e.starts_at)}`,
        },
      ];
    }
    const a = articleById.get(s.item_id);
    if (!a) return [];
    return [
      {
        key: `article-${s.item_id}`,
        href: `/explore/articles/${s.item_id}`,
        title: a.title,
        subtitle: `Article · ${readingMinutes(a.body)} min`,
      },
    ];
  });

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

      {/* Saved section — the fan's bookmarked events and articles, newest-first. */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Saved
      </h2>
      {savedItems.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3">
          {savedItems.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand"
              >
                <span className="size-12 shrink-0 rounded-lg bg-muted" />
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-snug">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.subtitle}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing saved yet — save events and articles to find them here.
        </p>
      )}

      {/* Mobile-only logout — desktop has the sidebar control instead. */}
      <LogoutButton className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 md:hidden" />
    </main>
  );
}
