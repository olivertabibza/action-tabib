import Link from "next/link";
import { Rss } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { titleCase } from "@/lib/marketplace";
import { ComposeBox } from "./compose-box";

type Actor = {
  display_name: string | null;
  role: string | null;
  headline: string | null;
};

type FeedEvent = {
  id: string;
  kind: string;
  body: string;
  subject_id: string | null;
  metadata: { target_name?: string | null } | null;
  created_at: string;
  actor: Actor | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // The Pro gate (auth + approved professional) lives in app/dashboard/layout.tsx.
  // RLS already scopes this to the current user plus the people they follow.
  const { data, error } = await supabase
    .from("activity_events")
    .select(
      "id, kind, body, subject_id, metadata, created_at, actor:profiles!activity_events_actor_id_fkey(display_name, role, headline)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const events = (data ?? []).map((e) => ({
    ...e,
    actor: e.actor as unknown as Actor | null,
  })) as FeedEvent[];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Your feed
      </h1>
      <p className="mt-2 text-muted-foreground">
        Updates from you and the creators you follow.
      </p>

      <div className="mt-8">
        <ComposeBox />
      </div>

      {error && (
        <p className="mt-6 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Couldn&rsquo;t load your feed: {error.message}
        </p>
      )}

      {!error && events.length > 0 ? (
        <ul className="mt-8 flex flex-col gap-4">
          {events.map((event) => (
            <li key={event.id}>
              <FeedItem event={event} />
            </li>
          ))}
        </ul>
      ) : (
        !error && (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <Rss className="size-8 text-muted-foreground" />
            <p className="font-medium">Your feed is quiet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Post an update above, or{" "}
              <Link href="/network" className="text-brand hover:underline">
                find creators to follow
              </Link>{" "}
              to fill your feed.
            </p>
          </div>
        )
      )}
    </main>
  );
}

function FeedItem({ event }: { event: FeedEvent }) {
  const actorName = event.actor?.display_name || "A creator";
  const when = new Date(event.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <header className="flex items-baseline justify-between gap-3">
        <span className="font-medium">
          {actorName}
          {event.actor?.role ? (
            <span className="text-muted-foreground">
              {" "}
              · {titleCase(event.actor.role)}
            </span>
          ) : null}
        </span>
        <time className="shrink-0 text-xs text-muted-foreground">{when}</time>
      </header>

      {event.kind === "status_update" ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
          {event.body}
        </p>
      ) : event.kind === "started_following" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          is now following{" "}
          <span className="text-foreground/90">
            {event.metadata?.target_name || "another creator"}
          </span>
          .
        </p>
      ) : null}
    </article>
  );
}
