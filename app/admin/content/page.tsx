import Link from "next/link";
import {
  CalendarDays,
  GraduationCap,
  Inbox,
  MapPin,
  Newspaper,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { titleCase } from "@/lib/marketplace";
import {
  eventTypeLabel,
  articleCategoryLabel,
  classLevelLabel,
  classFormatLabel,
  formatPrice,
} from "@/lib/content";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AdminNav } from "../admin-nav";
import { ContentDecisionButtons } from "../content-decision-buttons";

const STATUSES = ["pending", "published", "rejected"] as const;
type Status = (typeof STATUSES)[number];

type EventRow = {
  id: string;
  title: string;
  description: string;
  venue: string;
  event_type: string;
  starts_at: string;
  created_at: string;
  host: { display_name: string | null } | null;
};

type ArticleRow = {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  created_at: string;
  author: { display_name: string | null } | null;
};

type ClassRow = {
  id: string;
  title: string;
  description: string;
  discipline: string;
  level: string;
  format: string;
  venue: string;
  price_cents: number;
  capacity: number;
  starts_at: string;
  created_at: string;
  instructor: { display_name: string | null } | null;
};

function submittedOn(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status: Status = STATUSES.includes(statusParam as Status)
    ? (statusParam as Status)
    : "pending";

  const supabase = await createClient();

  const { data: eventData } = await supabase
    .from("events")
    .select(
      "id, title, description, venue, event_type, starts_at, created_at, host:profiles!events_created_by_fkey(display_name)"
    )
    .eq("status", status)
    .order("created_at", { ascending: false });
  const events = (eventData ?? []).map((e) => ({
    ...e,
    host: e.host as unknown as { display_name: string | null } | null,
  })) as EventRow[];

  const { data: articleData } = await supabase
    .from("articles")
    .select(
      "id, title, category, excerpt, created_at, author:profiles!articles_created_by_fkey(display_name)"
    )
    .eq("status", status)
    .order("created_at", { ascending: false });
  const articles = (articleData ?? []).map((a) => ({
    ...a,
    author: a.author as unknown as { display_name: string | null } | null,
  })) as ArticleRow[];

  const { data: classData } = await supabase
    .from("classes")
    .select(
      "id, title, description, discipline, level, format, venue, price_cents, capacity, starts_at, created_at, instructor:profiles!classes_created_by_fkey(display_name)"
    )
    .eq("status", status)
    .order("created_at", { ascending: false });
  const classes = (classData ?? []).map((c) => ({
    ...c,
    instructor: c.instructor as unknown as { display_name: string | null } | null,
  })) as ClassRow[];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Admin</h1>
      <p className="mt-2 text-muted-foreground">
        Review events, classes, and articles submitted by professionals.
      </p>

      <div className="mt-8">
        <AdminNav active="content" />
      </div>

      {/* Status filter */}
      <div className="mb-6 flex gap-1">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "pending" ? "/admin/content" : `/admin/content?status=${s}`}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors",
              s === status
                ? "bg-brand text-brand-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Events */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <CalendarDays className="size-4" />
        Events
      </h2>
      {events.length > 0 ? (
        <div className="mb-10 flex flex-col gap-4">
          {events.map((e) => {
            const host = e.host?.display_name || "Unknown host";
            const starts = new Date(e.starts_at);
            return (
              <Card key={e.id} className="p-2">
                <CardContent className="flex flex-col gap-3 pt-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold">
                      <Link
                        href={`/explore/events/${e.id}`}
                        className="hover:underline"
                      >
                        {e.title}
                      </Link>
                    </h3>
                    <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
                      {eventTypeLabel(e.event_type)}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Hosted by {host} · submitted {submittedOn(e.created_at)}
                  </p>

                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-4 text-brand" />
                      {submittedOn(e.starts_at)}{" "}
                      {starts.toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-4 text-brand" />
                      {e.venue || "Virtual"}
                    </span>
                  </p>

                  {e.description && (
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {e.description}
                    </p>
                  )}

                  <div className="border-t border-border pt-4">
                    <ContentDecisionButtons
                      kind="event"
                      id={e.id}
                      current={status}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState label={`No ${status} events.`} />
      )}

      {/* Articles */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Newspaper className="size-4" />
        Articles
      </h2>
      {articles.length > 0 ? (
        <div className="flex flex-col gap-4">
          {articles.map((a) => {
            const author = a.author?.display_name || "Unknown author";
            return (
              <Card key={a.id} className="p-2">
                <CardContent className="flex flex-col gap-3 pt-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold">
                      <Link
                        href={`/explore/articles/${a.id}`}
                        className="hover:underline"
                      >
                        {a.title}
                      </Link>
                    </h3>
                    <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
                      {articleCategoryLabel(a.category)}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    By {author} · submitted {submittedOn(a.created_at)}
                  </p>

                  {a.excerpt && (
                    <p className="text-sm text-muted-foreground">{a.excerpt}</p>
                  )}

                  <div className="border-t border-border pt-4">
                    <ContentDecisionButtons
                      kind="article"
                      id={a.id}
                      current={status}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState label={`No ${status} articles.`} />
      )}

      {/* Classes */}
      <h2 className="mb-3 mt-10 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <GraduationCap className="size-4" />
        Classes
      </h2>
      {classes.length > 0 ? (
        <div className="flex flex-col gap-4">
          {classes.map((c) => {
            const instructor = c.instructor?.display_name || "Unknown instructor";
            const starts = new Date(c.starts_at);
            const location =
              c.format === "virtual" ? "Virtual" : c.venue || "In person";
            return (
              <Card key={c.id} className="p-2">
                <CardContent className="flex flex-col gap-3 pt-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold">
                      <Link
                        href={`/classes/${c.id}`}
                        className="hover:underline"
                      >
                        {c.title}
                      </Link>
                    </h3>
                    <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
                      {titleCase(c.discipline)}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {classLevelLabel(c.level)}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Taught by {instructor} · submitted{" "}
                    {submittedOn(c.created_at)}
                  </p>

                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-4 text-brand" />
                      {submittedOn(c.starts_at)}{" "}
                      {starts.toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-4 text-brand" />
                      {location} · {classFormatLabel(c.format)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCap className="size-4 text-brand" />
                      {formatPrice(c.price_cents)} · {c.capacity} seats
                    </span>
                  </p>

                  {c.description && (
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {c.description}
                    </p>
                  )}

                  <div className="border-t border-border pt-4">
                    <ContentDecisionButtons
                      kind="class"
                      id={c.id}
                      current={status}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState label={`No ${status} classes.`} />
      )}
    </main>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="mb-10 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
      <Inbox className="size-7 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
