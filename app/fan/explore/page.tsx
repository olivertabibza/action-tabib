// Fan Explore — the fans' content surface. Articles and events come from the
// SAME tables pros publish to (published rows are anon-readable, so a normal
// server query works). The "films/filmmakers to follow" section is still a
// PLACEHOLDER: following filmmakers as a fan is a separate future feature.
import { createClient } from "@/lib/supabase/server";
import { eventTypeLabel, articleCategoryLabel } from "@/lib/content";
import { Avatar } from "@/components/Avatar";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// PLACEHOLDER — fan-side following of films/filmmakers isn't built yet.
const toFollow: { name: string; detail: string }[] = [
  { name: "Rising filmmakers", detail: "Directors and writers to watch" },
  { name: "New releases", detail: "Indie films screening now" },
];

type EventRow = {
  id: string;
  title: string;
  venue: string;
  event_type: string;
  starts_at: string;
};

type ArticleRow = {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  created_at: string;
  author: { display_name: string | null } | null;
};

export default async function FanExplorePage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // A short strip of upcoming published events.
  const { data: eventData } = await supabase
    .from("events")
    .select("id, title, venue, event_type, starts_at")
    .eq("status", "published")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(3);
  const events = (eventData ?? []) as EventRow[];

  // Published articles, newest first, with the author's name.
  const { data: articleData } = await supabase
    .from("articles")
    .select(
      "id, title, category, excerpt, created_at, author:profiles!articles_created_by_fkey(display_name)"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });
  const articles = (articleData ?? []).map((a) => ({
    ...a,
    author: a.author as unknown as { display_name: string | null } | null,
  })) as ArticleRow[];

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Explore</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Follow filmmakers and read what&rsquo;s happening in indie film.
      </p>

      {/* Films & filmmakers to follow (PLACEHOLDER — not wired yet) */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Films &amp; filmmakers to follow
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {toFollow.map(({ name, detail }) => (
          <Card key={name} className="p-2">
            <CardHeader>
              <CardTitle className="text-base">{name}</CardTitle>
              <CardDescription>{detail}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Happening soon (LIVE) */}
      {events.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Happening soon
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {events.map((e) => {
              const d = new Date(e.starts_at);
              const month = d
                .toLocaleDateString(undefined, { month: "short" })
                .toUpperCase();
              const day = d.toLocaleDateString(undefined, { day: "numeric" });
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
                >
                  <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wide">
                      {month}
                    </span>
                    <span className="text-xl font-bold leading-none">{day}</span>
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{e.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {eventTypeLabel(e.event_type)}
                      {e.venue ? ` · ${e.venue}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Articles & interviews (LIVE) */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Articles &amp; interviews
      </h2>
      {articles.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3">
          {articles.map((a) => {
            const author = a.author?.display_name || "the Action desk";
            return (
              <li
                key={a.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <span className="text-xs font-medium text-brand">
                  {articleCategoryLabel(a.category)}
                </span>
                <h3 className="mt-1 font-semibold leading-snug">{a.title}</h3>
                {a.excerpt && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.excerpt}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Avatar name={author} className="size-7 text-xs" />
                  <span className="text-xs text-muted-foreground">
                    By {author}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No articles published yet — check back soon.
        </p>
      )}
    </main>
  );
}
