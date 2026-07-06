import Link from "next/link";
import { Rss } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { titleCase } from "@/lib/marketplace";
import { Avatar } from "@/components/Avatar";

// The Fan home is the follow-only Feed tab. Auth + account gating live in
// app/fan/layout.tsx, not here.
//
// Consumers can't read the profiles table directly (RLS), so — unlike the pro
// dashboard, which embeds profiles in the activity_events query — we fetch actor
// names/roles from the public_profiles security-definer view separately and join
// them in memory.

type Actor = { display_name: string | null; role: string | null };

type FeedEvent = {
  id: string;
  kind: string;
  actor_id: string;
  body: string;
  subject_id: string | null;
  metadata: { target_name?: string | null } | null;
  created_at: string;
};

export default async function FanFeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Whom this fan follows. Their posts are the entire feed.
  const { data: myFollows } = user
    ? await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
    : { data: [] as { following_id: string }[] };
  const followingIds = (myFollows ?? []).map((f) => f.following_id as string);

  // Activity from the followed pros, newest first. RLS ("Read self and followed
  // activity") already scopes reads to people you follow; the actor_id filter
  // just narrows the query. No profiles join here — see the note above.
  const { data: eventData } =
    followingIds.length > 0
      ? await supabase
          .from("activity_events")
          .select("id, kind, actor_id, body, subject_id, metadata, created_at")
          .in("actor_id", followingIds)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [] as FeedEvent[] };
  const events = (eventData ?? []) as FeedEvent[];

  // Actor display info via the public view (consumers can't read profiles).
  const actorById = new Map<string, Actor>();
  if (events.length > 0) {
    const actorIds = [...new Set(events.map((e) => e.actor_id))];
    const { data: actors } = await supabase
      .from("public_profiles")
      .select("id, display_name, role")
      .in("id", actorIds);
    for (const a of actors ?? []) {
      actorById.set(a.id as string, {
        display_name: a.display_name as string | null,
        role: a.role as string | null,
      });
    }
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <header className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Action</h1>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
          Fan
        </span>
      </header>

      {events.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-4">
          {events.map((event) => (
            <li key={event.id}>
              <FeedItem event={event} actor={actorById.get(event.actor_id)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-16 flex flex-col items-center px-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Rss className="size-5" strokeWidth={1.75} />
          </span>
          <p className="mt-4 font-medium">Your feed will appear here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow filmmakers from{" "}
            <Link href="/fan/explore" className="text-brand hover:underline">
              Explore
            </Link>{" "}
            and their posts will show up here.
          </p>
        </div>
      )}
    </main>
  );
}

function FeedItem({
  event,
  actor,
}: {
  event: FeedEvent;
  actor: Actor | undefined;
}) {
  const actorName = actor?.display_name || "A filmmaker";
  const when = new Date(event.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const subtitle = `${actor?.role ? titleCase(actor.role) : "Filmmaker"} · ${when}`;

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex gap-3">
        <Avatar name={actorName} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{actorName}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>

          {event.kind === "status_update" ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
              {event.body}
            </p>
          ) : event.kind === "started_following" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              is now following{" "}
              <span className="text-foreground/90">
                {event.metadata?.target_name || "another filmmaker"}
              </span>
              .
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
