import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  GraduationCap,
  PartyPopper,
  Rss,
  UserPlus,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { viewerTimeZone } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { titleCase, disciplineLabel } from "@/lib/marketplace";
import { Avatar } from "@/components/Avatar";
import { CallboardCard } from "@/components/CallboardCard";
import { ComposeBox } from "./compose-box";
import { CommentThread } from "./comment-thread";
import { ConnectPill, type ConnectionState } from "./connect-pill";
import { CongratulateButton } from "./congratulate-button";

export const metadata: Metadata = { title: "Feed" };

type Actor = {
  display_name: string | null;
  role: string | null;
  avatar_path: string | null;
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
  avatar_path: string | null;
};

type ConnectionRequest = {
  id: string;
  display_name: string | null;
  role: string | null;
  avatar_path: string | null;
};

type EnrolledClass = {
  id: string;
  title: string;
  starts_at: string;
  instructor: { display_name: string | null } | null;
};

type RecentProject = {
  id: string;
  title: string;
  discipline: string;
  location: string;
  compensation: string;
};

/** Compact relative timestamp for post headers ("now", "5m", "2h", "6d"). */
function timeAgo(iso: string, tz: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: tz,
    month: "short",
    day: "numeric",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const tz = await viewerTimeZone();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The Pro gate (auth + approved professional) lives in app/dashboard/layout.tsx;
  // this guard just narrows the type and never want to render without a session.
  if (!user) {
    redirect("/login");
  }

  // The current user, for the composer avatar and the "For you" greeting.
  const { data: me } = await supabase
    .from("profiles")
    .select("display_name, avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  // Live feed. RLS already scopes this to the current user plus the people they
  // follow.
  const { data, error } = await supabase
    .from("activity_events")
    .select(
      "id, kind, actor_id, body, subject_id, metadata, created_at, actor:profiles!activity_events_actor_id_fkey(display_name, role, avatar_path)"
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

  // Congratulate counts + the viewer's own reactions, same one-grouped-query
  // shape as commentCounts (NOT reaction_count()/has_reacted() per post).
  const congratsCounts = new Map<string, number>();
  const congratulatedByMe = new Set<string>();
  if (events.length > 0) {
    const { data: reactionRows } = await supabase
      .from("activity_reactions")
      .select("event_id, actor_id")
      .in(
        "event_id",
        events.map((e) => e.id)
      );
    for (const row of reactionRows ?? []) {
      const id = row.event_id as string;
      congratsCounts.set(id, (congratsCounts.get(id) ?? 0) + 1);
      if (row.actor_id === user.id) congratulatedByMe.add(id);
    }
  }

  // Connect suggestions (LIVE) — approved professionals the user doesn't already
  // follow and isn't themselves. Same query shape as app/explore/(tab)/people/page.tsx.
  // Staff admins are left out of member lists.
  const { data: candidates } = await supabase
    .from("profiles")
    .select("id, display_name, role, avatar_path")
    .eq("account_type", "professional")
    .eq("application_status", "approved")
    .eq("is_admin", false)
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

  // Every Connect pill's state from ONE query: the viewer is a party to all of
  // their connection rows, so RLS returns exactly this set and the per-profile
  // state derives in TypeScript (no connection_status() per row).
  const { data: connectionRows } = await supabase
    .from("connections")
    .select("requester_id, addressee_id, status, created_at");
  const connectionStates = new Map<string, ConnectionState>();
  for (const c of connectionRows ?? []) {
    const other = (
      c.requester_id === user.id ? c.addressee_id : c.requester_id
    ) as string;
    connectionStates.set(
      other,
      c.status === "accepted"
        ? "connected"
        : c.requester_id === user.id
          ? "pending_outgoing"
          : "pending_incoming"
    );
  }

  // Incoming requests for "For you" — derived from the SAME rows above, newest
  // first. Only the first requester's name is shown, so one lookup.
  const incoming = (connectionRows ?? [])
    .filter((c) => c.addressee_id === user.id && c.status === "pending")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  let firstRequester: ConnectionRequest | null = null;
  if (incoming.length > 0) {
    const { data: requester } = await supabase
      .from("profiles")
      .select("id, display_name, role, avatar_path")
      .eq("id", incoming[0].requester_id as string)
      .maybeSingle();
    firstRequester = (requester as ConnectionRequest | null) ?? null;
  }

  // "N mutual" for the ≤3 suggestions only. mutual_connection_count IS an RPC
  // on purpose: the count can't be derived client-side without leaking the
  // graph.
  const mutualCounts = new Map<string, number>();
  await Promise.all(
    suggestions.map(async (s) => {
      const { data: n } = await supabase.rpc("mutual_connection_count", {
        target: s.id,
      });
      mutualCounts.set(s.id, Number(n ?? 0));
    })
  );

  const [enrollmentRes, recentProjectsRes] = await Promise.all([
    supabase
      .from("class_enrollments")
      .select(
        "class:classes(id, title, starts_at, instructor:profiles!classes_created_by_fkey(display_name))"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("projects")
      .select("id, title, discipline, location, compensation")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  // UX B-21: "Your class" is the NEXT class you're enrolled in, never one that
  // has already ended.
  const nowMs = new Date().getTime();
  const enrolledClass =
    ((enrollmentRes.data ?? [])
      .map((e) => e.class as unknown as EnrolledClass | null)
      .filter(
        (c): c is EnrolledClass =>
          !!c && new Date(c.starts_at).getTime() >= nowMs
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      )[0] ?? null);
  const recentProjects = (recentProjectsRes.data ?? []) as RecentProject[];

  const forYou = (
    <ForYouCard
      name={me?.display_name ?? null}
      projects={recentProjects}
      enrolledClass={enrolledClass}
      requestCount={incoming.length}
      firstRequester={firstRequester}
      tz={tz}
    />
  );

  // UX B-07 / PX F09: updates in the center, ONE side column of things to act
  // on. The old left rail (profile card and stats) moved to /profile; the
  // composer's dead post-type buttons, Endorse, Share and the Connect pill on
  // every post are gone.
  return (
    <main className="mx-auto grid w-full max-w-[1000px] flex-1 items-start gap-6 px-4 pb-11 pt-6 max-sm:px-3 max-sm:pt-3 wide:grid-cols-[minmax(0,1fr)_320px]">
      <h1 className="sr-only">Feed</h1>

      <div className="flex min-w-0 flex-col gap-4 max-sm:gap-3">
        {/* Below the wide breakpoint "For you" leads the page. */}
        <div className="wide:hidden">{forYou}</div>

        <h2 className="mt-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
          Updates
        </h2>
        <ComposeBox
          displayName={me?.display_name ?? null}
          photoPath={me?.avatar_path ?? null}
        />

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Couldn&rsquo;t load your feed: {error.message}
          </p>
        )}

        {!error && events.length > 0 ? (
          <ul className="flex flex-col gap-4 max-sm:gap-3">
            {events.map((event) => (
              <li key={event.id}>
                <FeedItem
                  event={event}
                  tz={tz}
                  currentUserId={user.id}
                  commentCount={commentCounts.get(event.id) ?? 0}
                  congratsCount={congratsCounts.get(event.id) ?? 0}
                  viewerCongratulated={congratulatedByMe.has(event.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          !error && (
            <CallboardCard className="flex flex-col items-center gap-3 py-16 text-center">
              <Rss className="size-8 text-text-tertiary" strokeWidth={1.5} />
              <p className="font-medium text-text-primary">
                Your feed is quiet
              </p>
              <p className="max-w-sm text-sm text-text-secondary">
                Post an update above, or{" "}
                <Link href="/explore/people" className="text-accent hover:underline">
                  find creators to follow
                </Link>{" "}
                to fill your feed.
              </p>
            </CallboardCard>
          )
        )}
      </div>

      {/* The one side column, from the wide breakpoint up. */}
      <div className="flex flex-col gap-4 max-wide:hidden">
        {forYou}
        {suggestions.length > 0 && (
          <CallboardCard className="p-4">
            <h2 className="font-condensed text-[21px] font-semibold leading-tight text-text-primary">
              Pros you may know
            </h2>
            <ul className="mt-3 flex flex-col gap-3.5">
              {suggestions.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <Avatar
                    name={s.display_name}
                    photoPath={s.avatar_path}
                    className="size-11 bg-avatar-fill text-text-secondary"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/profile/${s.id}`}
                      className="block truncate font-condensed text-[17px] font-semibold leading-tight text-text-primary transition-colors hover:text-accent"
                    >
                      {s.display_name || "Unnamed creator"}
                    </Link>
                    <p className="truncate text-[12.5px] text-text-tertiary">
                      {s.role ? titleCase(s.role) : "Pro"}
                      {(mutualCounts.get(s.id) ?? 0) > 0 &&
                        ` · ${mutualCounts.get(s.id)} mutual`}
                    </p>
                  </div>
                  <ConnectPill
                    targetId={s.id}
                    initialState={connectionStates.get(s.id) ?? "none"}
                  />
                </li>
              ))}
            </ul>
          </CallboardCard>
        )}
      </div>
    </main>
  );
}

/* ── For you ───────────────────────────────────────────────────────────── */

/**
 * The one card of things to act on (PX wireframe 1): newest open projects,
 * your next class, and connection requests waiting for you. Each row is a
 * single tap to where you deal with it. Hidden when there's nothing to show.
 */
function ForYouCard({
  name,
  projects,
  enrolledClass,
  requestCount,
  firstRequester,
  tz,
}: {
  name: string | null;
  projects: RecentProject[];
  enrolledClass: EnrolledClass | null;
  requestCount: number;
  firstRequester: ConnectionRequest | null;
  tz: string;
}) {
  const rows: {
    key: string;
    icon: React.ReactNode;
    title: string;
    detail: string;
    href: string;
    action: string;
  }[] = [];

  if (projects.length > 0) {
    const first = projects[0];
    rows.push({
      key: "projects",
      icon: <Briefcase className="size-[18px]" strokeWidth={1.5} />,
      title: "New on Projects",
      detail: [first.title, disciplineLabel(first.discipline), first.location]
        .filter(Boolean)
        .join(" · "),
      href: "/projects",
      action: "See",
    });
  }
  if (enrolledClass) {
    const when = new Date(enrolledClass.starts_at).toLocaleDateString(
      undefined,
      { timeZone: tz, weekday: "long", month: "short", day: "numeric" }
    );
    rows.push({
      key: "class",
      icon: <GraduationCap className="size-[18px]" strokeWidth={1.5} />,
      title: enrolledClass.title,
      detail: `Your class · ${when}`,
      href: `/classes/${enrolledClass.id}`,
      action: "Open",
    });
  }
  if (requestCount > 0) {
    rows.push({
      key: "requests",
      icon: <UserPlus className="size-[18px]" strokeWidth={1.5} />,
      title: `${requestCount} connection request${requestCount === 1 ? "" : "s"}`,
      detail: firstRequester
        ? [
            firstRequester.display_name || "A member",
            firstRequester.role ? titleCase(firstRequester.role) : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "Waiting for your answer",
      href: "/profile/network",
      action: "Review",
    });
  }

  if (rows.length === 0) return null;

  const firstName = name?.trim().split(/\s+/)[0];
  return (
    <CallboardCard className="p-4">
      <h2 className="font-condensed text-[21px] font-semibold leading-tight text-text-primary">
        {firstName ? `For you, ${firstName}` : "For you"}
      </h2>
      <ul className="mt-1">
        {rows.map((r, i) => (
          <li key={r.key} className={cn(i > 0 && "border-t border-border-hairline")}>
            <Link
              href={r.href}
              className="focus-ring flex min-h-14 items-center gap-3 rounded-lg py-3 transition-colors hover:text-accent"
            >
              <span className="flex size-[38px] shrink-0 items-center justify-center rounded-input border border-border-hairline bg-surface-sunken text-text-secondary">
                {r.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-condensed text-base font-semibold text-text-primary">
                  {r.title}
                </span>
                <span className="block truncate text-[12.5px] text-text-tertiary">
                  {r.detail}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent">
                {r.action}
                <ArrowRight className="size-3.5" strokeWidth={1.5} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </CallboardCard>
  );
}

/* ── Feed ──────────────────────────────────────────────────────────────── */

function FeedItem({
  event,
  tz,
  currentUserId,
  commentCount,
  congratsCount,
  viewerCongratulated,
}: {
  event: FeedEvent;
  tz: string;
  currentUserId: string;
  commentCount: number;
  congratsCount: number;
  viewerCongratulated: boolean;
}) {
  const actorName = event.actor?.display_name || "A creator";
  const isOwnPost = event.actor_id === currentUserId;
  const subtitle = event.actor?.role ? titleCase(event.actor.role) : "Creator";

  const proofLine =
    congratsCount > 0
      ? viewerCongratulated
        ? congratsCount === 1
          ? "You congratulated this"
          : `You and ${congratsCount - 1} other${congratsCount === 2 ? "" : "s"} congratulated this`
        : `${congratsCount} congratulated this`
      : null;

  return (
    <CallboardCard>
      <article>
        <div className="flex items-start gap-3.5 p-[18px] pb-0">
          <Avatar
            name={actorName}
            photoPath={event.actor?.avatar_path}
            className="size-[50px] bg-avatar-fill text-text-secondary"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-1.5">
              <Link
                href={`/profile/${event.actor_id}`}
                className="truncate font-condensed text-xl font-semibold leading-tight text-text-primary transition-colors hover:text-accent"
              >
                {actorName}
              </Link>
              <span className="shrink-0 text-[13px] text-text-tertiary">
                · {timeAgo(event.created_at, tz)}
              </span>
            </p>
            <p className="truncate text-[13.5px] text-text-secondary">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Every status_update renders in the design's single text-post shape:
            there is no post-kind metadata for milestone chips and no post-image
            storage, so those stay off rather than being invented. */}
        {event.kind === "status_update" ? (
          <p className="whitespace-pre-wrap px-[18px] pt-3 text-[15.5px] leading-[1.65] text-text-secondary">
            {event.body}
          </p>
        ) : event.kind === "started_following" ? (
          <p className="px-[18px] pt-3 text-[15px] text-text-tertiary">
            is now following{" "}
            <span className="text-text-secondary">
              {event.metadata?.target_name || "another creator"}
            </span>
            .
          </p>
        ) : null}

        {proofLine || commentCount > 0 ? (
          <div className="flex items-center justify-between gap-3 px-[18px] pb-2.5 pt-3.5 text-[13px] text-text-secondary">
            <span className="flex items-center gap-1.5">
              {proofLine && (
                <>
                  <PartyPopper
                    className="size-4 text-accent"
                    strokeWidth={1.5}
                  />
                  {proofLine}
                </>
              )}
            </span>
            {commentCount > 0 && (
              <span className="shrink-0 text-text-tertiary">
                {commentCount} comment{commentCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        ) : (
          <div className="pb-3.5" />
        )}

        <CommentThread
          eventId={event.id}
          currentUserId={currentUserId}
          actionsBefore={
            /* Congratulating your own post is hidden, matching the design. */
            !isOwnPost && (
              <CongratulateButton
                eventId={event.id}
                initialOn={viewerCongratulated}
              />
            )
          }
        />
      </article>
    </CallboardCard>
  );
}
