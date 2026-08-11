import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  Briefcase,
  CircleCheck,
  GraduationCap,
  PartyPopper,
  Rss,
  Share2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { titleCase, disciplineLabel, DISCIPLINES } from "@/lib/marketplace";
import { Avatar } from "@/components/Avatar";
import { CallboardCard } from "@/components/CallboardCard";
import { ConnectionRequestActions } from "@/components/ConnectionRequestActions";
import { ComposeBox } from "./compose-box";
import { CommentThread } from "./comment-thread";
import { FeedAction } from "./feed-action";
import { ConnectPill, type ConnectionState } from "./connect-pill";
import { CongratulateButton } from "./congratulate-button";
import {
  EndorseAction,
  EndorsePicker,
  type EndorsableSkill,
} from "./endorse-picker";

type Actor = {
  display_name: string | null;
  role: string | null;
  headline: string | null;
  skills: string[] | null;
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

type ConnectionRequest = {
  id: string;
  display_name: string | null;
  role: string | null;
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
function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * What a post's author can be endorsed for: their primary discipline
 * (profiles.role — free text, with legacy title-cased values like "Editor")
 * plus their secondary profiles.skills (discipline slugs). Deduped
 * case-insensitively, first occurrence winning, and each value kept EXACTLY as
 * stored: profile_lists_skill() matches the skills array case-sensitively and
 * endorsement_count() compares exactly, so only the label is prettified.
 */
function endorsableSkills(actor: Actor | null): EndorsableSkill[] {
  const seen = new Set<string>();
  const out: EndorsableSkill[] = [];
  for (const value of [actor?.role, ...(actor?.skills ?? [])]) {
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      value,
      label: (DISCIPLINES as readonly string[]).includes(key)
        ? disciplineLabel(value)
        : titleCase(value),
    });
  }
  return out;
}

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

  // The current user, for the composer avatar and the left-rail profile card.
  const { data: me } = await supabase
    .from("profiles")
    .select("display_name, role, headline")
    .eq("id", user.id)
    .maybeSingle();

  // Live feed. RLS already scopes this to the current user plus the people they
  // follow.
  const { data, error } = await supabase
    .from("activity_events")
    .select(
      "id, kind, actor_id, body, subject_id, metadata, created_at, actor:profiles!activity_events_actor_id_fkey(display_name, role, headline, skills)"
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

  // Every endorsement the viewer has given, in ONE query (the SELECT policy is
  // member-wide). Keyed subject::skill so each post's picker can pre-fill.
  const { data: myEndorsements } = await supabase
    .from("endorsements")
    .select("subject_id, skill")
    .eq("endorser_id", user.id);
  const endorsedByMe = new Set(
    (myEndorsements ?? []).map((e) => `${e.subject_id}::${e.skill}`)
  );

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

  // Incoming requests for the rail card — derived from the SAME rows above
  // (the viewer is a party to all of them), newest first. Only the requesters'
  // names need fetching, and that's one .in() query, never one per row.
  const incoming = (connectionRows ?? [])
    .filter((c) => c.addressee_id === user.id && c.status === "pending")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  let connectionRequests: ConnectionRequest[] = [];
  if (incoming.length > 0) {
    const { data: requesters } = await supabase
      .from("profiles")
      .select("id, display_name, role")
      .in(
        "id",
        incoming.map((c) => c.requester_id)
      );
    const byId = new Map(
      (requesters ?? []).map((p) => [p.id as string, p as ConnectionRequest])
    );
    connectionRequests = incoming
      .map((c) => byId.get(c.requester_id as string))
      .filter((p): p is ConnectionRequest => p !== undefined);
  }

  // "N mutual connections" — mutual_connection_count IS an RPC on purpose: the
  // count can't be derived client-side without leaking the graph. Called only
  // for people actually on screen: deduped post authors + the ≤3 suggestions.
  const mutualIds = new Set<string>();
  for (const e of events) {
    if (e.actor_id !== user.id) mutualIds.add(e.actor_id);
  }
  for (const s of suggestions) mutualIds.add(s.id);
  const mutualCounts = new Map<string, number>();
  await Promise.all(
    [...mutualIds].map(async (id) => {
      const { data: n } = await supabase.rpc("mutual_connection_count", {
        target: id,
      });
      mutualCounts.set(id, Number(n ?? 0));
    })
  );

  // Rail stats, in parallel. Vouches and classes taken are direct counts (their
  // SELECT policies already permit them); connection_count is the RPC.
  const [
    connectionCountRes,
    vouchesRes,
    classesTakenRes,
    savedRes,
    enrollmentRes,
    recentProjectsRes,
  ] = await Promise.all([
    supabase.rpc("connection_count", { p_profile_id: user.id }),
    supabase
      .from("endorsements")
      .select("*", { count: "exact", head: true })
      .eq("subject_id", user.id),
    supabase
      .from("class_enrollments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("saved_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("class_enrollments")
      .select(
        "class:classes(id, title, starts_at, instructor:profiles!classes_created_by_fkey(display_name))"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id, title, discipline, location, compensation")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const connectionCount = Number(connectionCountRes.data ?? 0);
  const vouches = vouchesRes.count ?? 0;
  const classesTaken = classesTakenRes.count ?? 0;
  const savedCount = savedRes.count ?? 0;
  const enrolledClass =
    (enrollmentRes.data?.class as unknown as EnrolledClass | null) ?? null;
  const recentProjects = (recentProjectsRes.data ?? []) as RecentProject[];

  return (
    <main className="callboard-grid w-full flex-1 pb-11 pt-6 max-sm:pt-3">
      <h1 className="sr-only">Feed</h1>

      {/* Left rail — drops entirely below the rail breakpoint. */}
      <div className="flex flex-col gap-4 max-rail:hidden">
        <ProfileCard
          name={me?.display_name ?? null}
          role={me?.role ?? null}
          headline={me?.headline ?? null}
          connections={connectionCount}
          vouches={vouches}
          classesTaken={classesTaken}
        />
        {/* The design's "Saved projects" row. The count is real, but it counts
            saved_items — whose item_type is constrained to 'event' | 'article'
            (supabase/saved-items.sql), so projects are not saveable and the
            label says "items". Not a link: no Pro-side saved-items index exists
            yet (the only listing is the Fan profile). */}
        <CallboardCard>
          <div className="flex items-center gap-2.5 px-4 py-3.5">
            <Bookmark
              className="size-[19px] text-text-secondary"
              strokeWidth={1.5}
            />
            <span className="flex-1 text-[14.5px] font-medium text-text-primary">
              Saved items
            </span>
            <span className="font-mono text-[13px] font-semibold text-accent">
              {savedCount}
            </span>
          </div>
        </CallboardCard>
      </div>

      {/* Center column. */}
      <div className="flex min-w-0 flex-col gap-4 max-sm:gap-3">
        <ComposeBox displayName={me?.display_name ?? null} />

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Couldn&rsquo;t load your feed: {error.message}
          </p>
        )}

        {!error && events.length > 0 ? (
          <ul className="flex flex-col gap-4 max-sm:gap-3">
            {events.map((event) => {
              // No endorsing yourself (the CHECK and the picker agree).
              const skills =
                event.actor_id === user.id ? [] : endorsableSkills(event.actor);
              return (
                <li key={event.id}>
                  <FeedItem
                    event={event}
                    currentUserId={user.id}
                    commentCount={commentCounts.get(event.id) ?? 0}
                    congratsCount={congratsCounts.get(event.id) ?? 0}
                    viewerCongratulated={congratulatedByMe.has(event.id)}
                    mutualCount={mutualCounts.get(event.actor_id) ?? 0}
                    connectionState={
                      connectionStates.get(event.actor_id) ?? "none"
                    }
                    skills={skills}
                    endorsedSkills={skills
                      .filter((s) =>
                        endorsedByMe.has(`${event.actor_id}::${s.value}`)
                      )
                      .map((s) => s.value)}
                  />
                </li>
              );
            })}
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
                <Link href="/network" className="text-accent hover:underline">
                  find creators to follow
                </Link>{" "}
                to fill your feed.
              </p>
            </CallboardCard>
          )
        )}
      </div>

      {/* Right rail — drops below the wide breakpoint. */}
      <div className="flex flex-col gap-4 max-wide:hidden">
        {enrolledClass && <ClassCard enrolled={enrolledClass} />}
        {recentProjects.length > 0 && (
          <RecentProjectsCard projects={recentProjects} />
        )}
        {connectionRequests.length > 0 && (
          <ConnectionRequestsCard requests={connectionRequests} />
        )}
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

/* ── Left rail ─────────────────────────────────────────────────────────── */

function ProfileCard({
  name,
  role,
  headline,
  connections,
  vouches,
  classesTaken,
}: {
  name: string | null;
  role: string | null;
  headline: string | null;
  connections: number;
  vouches: number;
  classesTaken: number;
}) {
  const roleLine = [role ? titleCase(role) : null, headline]
    .filter(Boolean)
    .join(" · ");
  return (
    <CallboardCard>
      <div className="h-16 bg-accent-tint" />
      <div className="px-4 pb-4">
        <Avatar
          name={name}
          className="-mt-[34px] size-[68px] bg-avatar-fill text-lg text-text-secondary ring-4 ring-surface"
        />
        <Link
          href="/profile"
          className="mt-2.5 block font-condensed text-[23px] font-semibold leading-tight text-text-primary transition-colors hover:text-accent"
        >
          {name || "Your profile"}
        </Link>
        {roleLine && (
          <p className="mt-0.5 text-[13.5px] text-text-secondary">{roleLine}</p>
        )}
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-accent">
          <CircleCheck className="size-3.5" strokeWidth={1.5} />
          Verified pro
          {vouches > 0 && ` · ${vouches} ${vouches === 1 ? "vouch" : "vouches"}`}
        </p>
        <div className="mt-3.5 flex flex-col gap-[9px] border-t border-border-hairline pt-3.5">
          <StatRow label="Connections" value={connections} />
          <StatRow label="Classes taken" value={classesTaken} />
        </div>
      </div>
    </CallboardCard>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <p className="flex items-center justify-between text-[13.5px]">
      <span className="text-text-secondary">{label}</span>
      <span className="font-mono text-[13px] font-semibold text-text-primary">
        {value}
      </span>
    </p>
  );
}

/* ── Feed ──────────────────────────────────────────────────────────────── */

function FeedItem({
  event,
  currentUserId,
  commentCount,
  congratsCount,
  viewerCongratulated,
  mutualCount,
  connectionState,
  skills,
  endorsedSkills,
}: {
  event: FeedEvent;
  currentUserId: string;
  commentCount: number;
  congratsCount: number;
  viewerCongratulated: boolean;
  mutualCount: number;
  connectionState: ConnectionState;
  skills: EndorsableSkill[];
  endorsedSkills: string[];
}) {
  const actorName = event.actor?.display_name || "A creator";
  const isOwnPost = event.actor_id === currentUserId;
  const subtitle = [
    event.actor?.role ? titleCase(event.actor.role) : "Creator",
    mutualCount > 0
      ? `${mutualCount} mutual connection${mutualCount === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
                · {timeAgo(event.created_at)}
              </span>
            </p>
            <p className="truncate text-[13.5px] text-text-secondary">
              {subtitle}
            </p>
          </div>
          {!isOwnPost && (
            <ConnectPill targetId={event.actor_id} initialState={connectionState} />
          )}
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

        {/* EndorsePicker wraps the bar so its trigger (inside the bar) and its
            panel (below it) share one open state; without endorsable skills it
            is absent and EndorseAction renders nothing. */}
        <EndorsePicker
          subjectId={event.actor_id}
          skills={skills}
          endorsed={endorsedSkills}
        >
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
            actionsAfter={
              <>
                {/* Endorse drops on mobile per the design's three-up bar. */}
                <EndorseAction className="max-sm:hidden" />
                {/* Share stays non-interactive: there is no per-post permalink
                    route in this app, so it would have nothing to copy. */}
                <FeedAction>
                  <Share2 className="size-[17px]" strokeWidth={1.5} />
                  Share
                </FeedAction>
              </>
            }
          />
        </EndorsePicker>
      </article>
    </CallboardCard>
  );
}

/* ── Right rail ────────────────────────────────────────────────────────── */

/** Incoming pending requests. Without this card a request is only discoverable
 * if that person happens to post. Capped at 5 with a plain count line — there
 * is no requests route to link to. */
function ConnectionRequestsCard({ requests }: { requests: ConnectionRequest[] }) {
  const shown = requests.slice(0, 5);
  const extra = requests.length - shown.length;
  return (
    <CallboardCard className="p-4">
      <h2 className="font-condensed text-[21px] font-semibold leading-tight text-text-primary">
        Connection requests
      </h2>
      <ul className="mt-3 flex flex-col gap-3.5">
        {shown.map((r) => (
          <li key={r.id} className="flex gap-3">
            <Avatar
              name={r.display_name}
              className="size-11 bg-avatar-fill text-text-secondary"
            />
            <div className="min-w-0 flex-1">
              <Link
                href={`/profile/${r.id}`}
                className="block truncate font-condensed text-[17px] font-semibold leading-tight text-text-primary transition-colors hover:text-accent"
              >
                {r.display_name || "Unnamed creator"}
              </Link>
              <p className="truncate text-[12.5px] text-text-tertiary">
                {r.role ? titleCase(r.role) : "Pro"}
              </p>
              <ConnectionRequestActions requesterId={r.id} className="mt-2" />
            </div>
          </li>
        ))}
      </ul>
      {extra > 0 && (
        <p className="mt-3 text-[12.5px] text-text-tertiary">+{extra} more</p>
      )}
    </CallboardCard>
  );
}

/** Rendered only when the user has a real enrollment. The design's session
 * progress bar is omitted rather than faked — there is no session tracking. */
function ClassCard({ enrolled }: { enrolled: EnrolledClass }) {
  const when = new Date(enrolled.starts_at).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return (
    <CallboardCard className="p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
        <GraduationCap className="size-4" strokeWidth={1.5} />
        Your class
      </p>
      <h2 className="mt-2 font-condensed text-[21px] font-semibold leading-tight text-text-primary">
        {enrolled.title}
      </h2>
      <p className="mt-1 text-[13.5px] text-text-secondary">
        {[enrolled.instructor?.display_name, when].filter(Boolean).join(" · ")}
      </p>
      <Link
        href={`/classes/${enrolled.id}`}
        className="focus-ring mt-3.5 block rounded-full bg-accent px-4 py-2.5 text-center text-[13.5px] font-semibold text-on-accent transition-opacity hover:opacity-90"
      >
        View class
      </Link>
    </CallboardCard>
  );
}

/** Honest replacement for the design's "Auditions matched to you": there is
 * no matching logic, so this lists the newest open projects with no invented
 * match reasons or rates. */
function RecentProjectsCard({ projects }: { projects: RecentProject[] }) {
  return (
    <CallboardCard className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-condensed text-[21px] font-semibold leading-tight text-text-primary">
          New on Projects
        </h2>
        <Link
          href="/projects"
          className="flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline"
        >
          See all
          <ArrowRight className="size-3.5" strokeWidth={1.5} />
        </Link>
      </div>
      <ul className="mt-1">
        {projects.map((p, i) => (
          <li
            key={p.id}
            className={cn(
              "flex items-center gap-3 py-3",
              i > 0 && "border-t border-border-hairline"
            )}
          >
            <span className="flex size-[42px] shrink-0 items-center justify-center rounded-input border border-border-hairline bg-surface-sunken">
              <Briefcase
                className="size-[19px] text-text-secondary"
                strokeWidth={1.5}
              />
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/projects/${p.id}`}
                className="block truncate font-condensed text-base font-semibold text-text-primary transition-colors hover:text-accent"
              >
                {p.title}
              </Link>
              <p className="truncate text-[12.5px] text-text-tertiary">
                {[disciplineLabel(p.discipline), p.location]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="shrink-0 text-[13px] font-semibold text-accent">
              {titleCase(p.compensation)}
            </span>
          </li>
        ))}
      </ul>
    </CallboardCard>
  );
}
