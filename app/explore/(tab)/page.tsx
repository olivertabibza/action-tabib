import Link from "next/link";
import { CalendarDays, Newspaper } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { eventTypeLabel, articleCategoryLabel } from "@/lib/content";
import { Avatar } from "@/components/Avatar";

// Access (auth + approved pro) is gated in the (tab) route group's layout, which
// also renders the ProShell around this page. The article/event DETAIL pages
// live outside that group and are public — see app/explore/articles/[id] and
// app/explore/events/[id].

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

export default async function ExplorePage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // Published, upcoming events — soonest first. RLS exposes published rows to
  // everyone, so a normal server query is all that's needed.
  const { data: eventData } = await supabase
    .from("events")
    .select("id, title, venue, event_type, starts_at")
    .eq("status", "published")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true });
  const events = (eventData ?? []) as EventRow[];

  // Published articles — newest first, with the author's name via a profiles
  // join (same shape as the dashboard feed).
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
        Events, screenings, and articles from the film community.
      </p>

      {/* Upcoming events */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Upcoming events
      </h2>
      {events.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/explore/events/${e.id}`} className="block">
                <EventCard event={e} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<CalendarDays className="size-7 text-muted-foreground" />}
          title="No upcoming events"
          body="Screenings, Q&As, panels, and mixers will show up here once they're published."
        />
      )}

      {/* Read */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Read
      </h2>
      {articles.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3">
          {articles.map((a) => (
            <li key={a.id}>
              <Link href={`/explore/articles/${a.id}`} className="block">
                <ArticleCard article={a} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Newspaper className="size-7 text-muted-foreground" />}
          title="No articles yet"
          body="Interviews, craft pieces, and scene reports will appear here once they're published."
        />
      )}
    </main>
  );
}

function EventCard({ event }: { event: EventRow }) {
  const d = new Date(event.starts_at);
  const month = d
    .toLocaleDateString(undefined, { month: "short" })
    .toUpperCase();
  const day = d.toLocaleDateString(undefined, { day: "numeric" });

  return (
    <article className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand">
      <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-brand/10 text-brand">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide">
          {month}
        </span>
        <span className="text-xl font-bold leading-none">{day}</span>
      </span>
      <div className="min-w-0">
        <p className="font-semibold leading-snug">{event.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {eventTypeLabel(event.event_type)}
          {event.venue ? ` · ${event.venue}` : ""}
        </p>
      </div>
    </article>
  );
}

function ArticleCard({ article }: { article: ArticleRow }) {
  const author = article.author?.display_name || "the Action desk";
  return (
    <article className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand">
      <span className="text-xs font-medium text-brand">
        {articleCategoryLabel(article.category)}
      </span>
      <h3 className="mt-1 font-semibold leading-snug">{article.title}</h3>
      {article.excerpt && (
        <p className="mt-1 text-sm text-muted-foreground">{article.excerpt}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Avatar name={author} className="size-7 text-xs" />
        <span className="text-xs text-muted-foreground">By {author}</span>
      </div>
    </article>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
      {icon}
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
