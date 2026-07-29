import Link from "next/link";
import { redirect } from "next/navigation";
import { PartyPopper, Rss, Star } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/marketplace";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/app/network/follow-button";
import { ComposeBox } from "./compose-box";
import { CommentThread } from "./comment-thread";

// PLACEHOLDER — class recommendations need a classes table; see Classes stub at
// /classes. The whole Recommended card is rendered from this constant, NOT from
// real data: there is no classes/enrollment table yet, and no way to know which
// of your connections took a class.
const RECOMMENDED_CLASS = {
  title: "Scene Study: Auditioning for Camera",
  instructor: "Maya Cortez",
  rating: 4.8,
  takenBy: ["Jordan Lee", "Sam Rivera", "Alex Kim"],
};

type Actor = {
  display_name: string | null;
  role: string | null;
  headline: string | null;
};

type FeedEvent = {
  id: string;
  kind: string;
  actor_id: string;
  body: string;
  subject_id: string | null;
  metadata: { target_name?: string | null } | null;
  created_at: string;
  actor: Actor | null;
};

type Suggestion = {
  id: string;
  display_name: string | null;
  role: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The Pro gate (auth + approved professional) lives in app/dashboard/layout.tsx;
  // this guard just narrows the type and never want to render without a session.
  if (!user) {
    redirect("/login");
  }

  // The current user's name, for the compose-box avatar.
  const { data: me } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  // Live feed. RLS already scopes this to the current user plus the people they
  // follow.
  const { data, error } = await supabase
    .from("activity_events")
    .select(
      "id, kind, actor_id, body, subject_id, metadata, created_at, actor:profiles!activity_events_actor_id_fkey(display_name, role, headline)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const events = (data ?? []).map((e) => ({
    ...e,
    actor: e.actor as unknown as Actor | null,
  })) as FeedEvent[];

  // Comment counts for the visible events in ONE grouped query (no per-post
  // fetch). RLS on activity_comments already restricts rows to visible events.
  const commentCounts = new Map<string, number>();
  if (events.length > 0) {
    const { data: commentRows } = await supabase
      .from("activity_comments")
      .select("event_id")
      .in(
        "event_id",
        events.map((e) => e.id)
      );
    for (const row of commentRows ?? []) {
      const id = row.event_id as string;
      commentCounts.set(id, (commentCounts.get(id) ?? 0) + 1);
    }
  }

  // Connect suggestions (LIVE) — approved professionals the user doesn't already
  // follow and isn't themselves. Same query shape as app/network/page.tsx.
  const { data: candidates } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("account_type", "professional")
    .eq("application_status", "approved")
    .neq("id", user.id)
    .order("display_name", { nullsFirst: false });

  const { data: myFollows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);
  const followingSet = new Set(
    (myFollows ?? []).map((f) => f.following_id as string)
  );

  const suggestions: Suggestion[] = (candidates ?? [])
    .filter((c) => !followingSet.has(c.id))
    .slice(0, 3);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      {/* The "Action" wordmark and the Messages icon both live in ProShell; the
          page keeps just its own title so it doesn't fight the fixed top-right
          Messages button. */}
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your feed</h1>
      <p className="mt-2 text-muted-foreground">
        Updates from you and the creators you follow.
      </p>

      <div className="mt-8">
        <ComposeBox displayName={me?.display_name ?? null} />
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
              <FeedItem
                event={event}
                currentUserId={user.id}
                commentCount={commentCounts.get(event.id) ?? 0}
              />
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

      {/* Recommended (STUBBED) and Connect suggestions (LIVE) show regardless of
          whether the feed itself has any items. */}
      <RecommendedCard />

      {suggestions.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
            Suggested — on a similar path to you
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
                <Avatar name={s.display_name} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/profile/${s.id}`}
                    className="block truncate font-semibold transition-colors hover:text-brand"
                  >
                    {s.display_name || "Unnamed creator"}
                  </Link>
                  {/* No mutual-connections count: the follows RLS only exposes
                      edges the current user is part of, so "N mutual" can't be
                      read for other people without weakening the security model. */}
                  <p className="text-xs text-muted-foreground">
                    {s.role ? `${titleCase(s.role)} · ` : ""}pre-union
                  </p>
                </div>
                <FollowButton targetId={s.id} initialFollowing={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function FeedItem({
  event,
  currentUserId,
  commentCount,
}: {
  event: FeedEvent;
  currentUserId: string;
  commentCount: number;
}) {
  const actorName = event.actor?.display_name || "A creator";
  const isOwnPost = event.actor_id === currentUserId;
  const when = new Date(event.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const subtitle = `${
    event.actor?.role ? titleCase(event.actor.role) : "Creator"
  } · ${when}`;

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex gap-3">
        <Avatar name={actorName} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{actorName}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>

          {event.kind === "status_update" ? (
            <>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
                {event.body}
              </p>
              {/* TODO: reactions aren't wired yet — "Congratulate" is a visual
                  affordance only (no server action / no count). Hidden on your
                  own posts — you can't congratulate yourself. */}
              {!isOwnPost && (
                <div className="mt-3">
                  <Button type="button" variant="outline" size="sm">
                    <PartyPopper className="size-3.5" />
                    Congratulate
                  </Button>
                </div>
              )}
            </>
          ) : event.kind === "started_following" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              is now following{" "}
              <span className="text-foreground/90">
                {event.metadata?.target_name || "another creator"}
              </span>
              .
            </p>
          ) : null}

          <CommentThread
            eventId={event.id}
            currentUserId={currentUserId}
            initialCount={commentCount}
          />
        </div>
      </div>
    </article>
  );
}

function RecommendedCard() {
  const { title, instructor, rating, takenBy } = RECOMMENDED_CLASS;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
        Recommended · {takenBy.length} of your connections took this
      </h2>
      <article className="mt-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">with {instructor}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium">
            <Star className="size-4 fill-brand text-brand" />
            {rating}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex">
            {takenBy.map((name, i) => (
              <Avatar
                key={name}
                name={name}
                className={cn(
                  "size-7 text-xs ring-2 ring-card",
                  i > 0 && "-ml-2"
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            Taken by {takenBy.join(", ")}
          </span>
        </div>
      </article>
    </section>
  );
}
