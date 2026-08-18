-- ============================================================================
-- Connections, reactions & endorsements (Callboard Phase 2 — schema only)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
-- Additive and forward-only: nothing here alters existing tables or policies.
--
-- Run this ONCE in the Supabase SQL editor, AFTER marketplace.sql
-- (is_approved_pro), fan-follows.sql (is_member), comments.sql
-- (can_view_event), multi-discipline.sql (profiles.skills), and classes.sql
-- (class_enrollments) — it reuses their helpers and tables.
--
-- Connections are the Callboard design's BIDIRECTIONAL relationship, and they
-- coexist with public.follows rather than replacing it. follows keeps every
-- job it has today (the feed, the messaging free-pass rule, the Requests tab)
-- and is not touched by this file. A connection row is DIRECTIONAL — we keep
-- who asked (requester_id) so the UI can render Pending-outgoing vs
-- Pending-incoming — but the relationship is SYMMETRIC once accepted: either
-- side counts as "connected" and either side may disconnect.
--
-- Connect is PRO-TO-PRO only (both parties must be approved professionals);
-- Fans keep using follows. Endorsements ("vouched by …") are member-visible;
-- connections are visible only to their two parties, with cross-user reads
-- flowing exclusively through the scalar security-definer helpers below.
--
-- As everywhere else in this app, elevated reads come from Row Level Security
-- via security-definer helpers, NOT from the service-role / secret key. An
-- inline count(*)/exists() inside a policy runs under the CALLER's own SELECT
-- policy and silently returns the wrong answer — the exact bug that hit class
-- capacity (see classes.sql §4) — so every read that crosses users here is a
-- security-definer function, including identity checks on the OTHER party.
-- ============================================================================


-- ── 1. connections ──────────────────────────────────────────────────────────
-- One row per requested/accepted connection. pair_lo/pair_hi are stored
-- generated columns holding the two ids in canonical order, and the unique
-- index on them blocks a reciprocal duplicate (A→B while B→A already exists)
-- at the database layer — a check-then-insert in app code can't win that race.
-- least()/greatest() over uuid is immutable, so Postgres accepts it in a
-- generated column (verified on Postgres 16).
create table if not exists public.connections (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending'
    check (status in ('pending','accepted')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  pair_lo      uuid generated always as (least(requester_id, addressee_id)) stored,
  pair_hi      uuid generated always as (greatest(requester_id, addressee_id)) stored,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create unique index if not exists connections_pair_uniq
  on public.connections (pair_lo, pair_hi);

-- Requester-side lookups ride the primary key's (requester_id, …) prefix and
-- addressee-side lookups ride this composite's prefix, so those two
-- single-column indexes would be pure redundancy — this one index serves both
-- the incoming-requests query (addressee_id, status = 'pending') and plain
-- addressee_id scans.
create index if not exists connections_addressee_status_idx
  on public.connections (addressee_id, status);

-- Freeze the pair on UPDATE. RLS WITH CHECK sees only the NEW row, so without
-- this the addressee could rewrite requester_id while accepting and fabricate
-- an accepted connection to a third party who never asked. A BEFORE UPDATE
-- trigger is the only place OLD and NEW can be compared.
create or replace function public.connections_freeze_pair()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.requester_id <> old.requester_id
     or new.addressee_id <> old.addressee_id then
    raise exception 'connections: requester_id and addressee_id are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists connections_freeze_pair on public.connections;
create trigger connections_freeze_pair
  before update on public.connections
  for each row execute function public.connections_freeze_pair();


-- ── 2. activity_reactions ───────────────────────────────────────────────────
-- One row per (event, actor, kind) — the Congratulate toggle. The composite
-- primary key makes a reaction idempotent (insert twice = PK violation) and a
-- delete toggles it off. kind is constrained to the one verb that exists
-- today; widen the check when new verbs ship. Event-side count lookups ride
-- the primary key's (event_id, …) prefix, so no extra index is needed.
create table if not exists public.activity_reactions (
  event_id   uuid not null references public.activity_events (id) on delete cascade,
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('congratulate')),
  created_at timestamptz not null default now(),
  primary key (event_id, actor_id, kind)
);


-- ── 3. endorsements ─────────────────────────────────────────────────────────
-- "Vouch" for a skill: one row per (endorser, subject, skill). The primary key
-- makes an endorsement idempotent; the CHECK stops self-endorsement. skill is
-- validated against the subject's actual disciplines in the INSERT policy via
-- profile_lists_skill(), not with a table check — the vocabulary lives on the
-- profile, not here.
create table if not exists public.endorsements (
  endorser_id uuid not null references public.profiles (id) on delete cascade,
  subject_id  uuid not null references public.profiles (id) on delete cascade,
  skill       text not null,
  created_at  timestamptz not null default now(),
  primary key (endorser_id, subject_id, skill),
  check (endorser_id <> subject_id)
);

-- The profile page reads "N endorsements for <skill>" by subject, which the
-- (endorser_id, …)-leading primary key can't serve.
create index if not exists endorsements_subject_skill_idx
  on public.endorsements (subject_id, skill);


-- ── 4. Security-definer helpers: identity checks ────────────────────────────

-- Is THAT profile an approved pro? The existing is_approved_pro() takes no
-- argument and only ever checks auth.uid(); Connect is pro-to-pro, so the
-- INSERT policies below must vet the OTHER party too, and an inline exists()
-- over profiles would run under the caller's profiles SELECT policy and lie
-- (same failure mode as the class-capacity bug — see classes.sql §4).
-- security definer bypasses that SELECT RLS for this one boolean; callers
-- learn approved-or-not, nothing else. Same predicate as is_approved_pro().
create or replace function public.profile_is_approved_pro(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id
      and p.account_type = 'professional'
      and p.application_status = 'approved'
  );
$$;

grant execute on function public.profile_is_approved_pro(uuid) to anon, authenticated;

-- Does that profile actually list this skill? Validated against BOTH columns,
-- deliberately: profiles.skills (multi-discipline.sql) holds SECONDARY skills
-- only and is empty on most profiles, while the PRIMARY discipline lives in
-- profiles.role — free text, with legacy title-cased values like 'Editor',
-- hence the lower() on both sides. Without the role arm you could not endorse
-- an actor for acting, the common case in the design's Endorse picker.
-- security definer for the same reason as profile_is_approved_pro(): the
-- endorsements INSERT policy needs to read the SUBJECT's profile, not the
-- caller's.
create or replace function public.profile_lists_skill(p_profile_id uuid, p_skill text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id
      and (lower(p.role) = lower(p_skill) or p_skill = any (p.skills))
  );
$$;

grant execute on function public.profile_lists_skill(uuid, text) to anon, authenticated;


-- ── 5. Security-definer helpers: connection reads ───────────────────────────
-- connections' SELECT policy is two-parties-only, so ANY cross-user question
-- ("are these two connected?", "how many connections?", "how many mutuals?")
-- would silently undercount if asked with an inline subquery running under the
-- caller's RLS. Each helper below runs as the function owner to see the whole
-- table for ITS ONE ANSWER — and each returns a bare scalar, never WHO, so the
-- two-parties-only privacy model stays intact.

-- Accepted connection between auth.uid() and target, in either direction.
-- The pair_lo/pair_hi lookup rides the unique pair index.
create or replace function public.are_connected(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.connections c
    where c.pair_lo = least(auth.uid(), target)
      and c.pair_hi = greatest(auth.uid(), target)
      and c.status = 'accepted'
  );
$$;

grant execute on function public.are_connected(uuid) to anon, authenticated;

-- The Connect pill's state for target, from the caller's point of view:
-- 'none' | 'pending_outgoing' | 'pending_incoming' | 'connected'.
create or replace function public.connection_status(target uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when c.status = 'accepted'       then 'connected'
        when c.requester_id = auth.uid() then 'pending_outgoing'
        else                                  'pending_incoming'
      end
      from public.connections c
      where c.pair_lo = least(auth.uid(), target)
        and c.pair_hi = greatest(auth.uid(), target)
    ),
    'none'
  );
$$;

grant execute on function public.connection_status(uuid) to anon, authenticated;

-- Accepted connections of a profile, both directions (the profile-card
-- "Connections 312" stat).
create or replace function public.connection_count(p_profile_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from public.connections c
  where c.status = 'accepted'
    and (c.requester_id = p_profile_id or c.addressee_id = p_profile_id);
$$;

grant execute on function public.connection_count(uuid) to anon, authenticated;

-- People accepted-connected to BOTH auth.uid() and target ("6 mutual
-- connections"). Symmetric by construction — each side of the INTERSECT is one
-- party's set of accepted counterparts — and immune to the RLS undercount
-- trap: the caller usually cannot SELECT the target's connection rows, so any
-- inline version of this query would return 0 for every mutual whose edge to
-- the target is invisible.
create or replace function public.mutual_connection_count(target uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from (
    select case when c.requester_id = auth.uid() then c.addressee_id
                else c.requester_id end
    from public.connections c
    where c.status = 'accepted'
      and (c.requester_id = auth.uid() or c.addressee_id = auth.uid())
    intersect
    select case when c.requester_id = target then c.addressee_id
                else c.requester_id end
    from public.connections c
    where c.status = 'accepted'
      and (c.requester_id = target or c.addressee_id = target)
  ) mutuals;
$$;

grant execute on function public.mutual_connection_count(uuid) to anon, authenticated;


-- ── 6. Security-definer helpers: reaction & endorsement counts ──────────────
-- Same elevation, same shape as class_seats_taken() (classes.sql §4): the
-- underlying SELECT policies scope raw rows, and these return the aggregate /
-- boolean the UI needs without widening row visibility.

-- Total reactions of one kind on an event ("… and 26 others congratulated").
create or replace function public.reaction_count(p_event_id uuid, p_kind text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from public.activity_reactions r
  where r.event_id = p_event_id
    and r.kind = p_kind;
$$;

grant execute on function public.reaction_count(uuid, text) to anon, authenticated;

-- Has the caller already reacted? Drives the Congratulate toggle's filled state.
create or replace function public.has_reacted(p_event_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.activity_reactions r
    where r.event_id = p_event_id
      and r.actor_id = auth.uid()
      and r.kind = p_kind
  );
$$;

grant execute on function public.has_reacted(uuid, text) to anon, authenticated;

-- Endorsement tally for one skill on one profile ("Verified pro · 9 vouches").
create or replace function public.endorsement_count(p_subject_id uuid, p_skill text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from public.endorsements e
  where e.subject_id = p_subject_id
    and e.skill = p_skill;
$$;

grant execute on function public.endorsement_count(uuid, text) to anon, authenticated;


-- ── 7. Security-definer helpers: "in your circle" counts ────────────────────
-- "Circle" here means the caller's ACCEPTED CONNECTIONS — nothing more. These
-- cross TWO RLS boundaries at once (other people's connections AND other
-- people's enrollments/applications), which is exactly why they must be
-- security definer: an inline join would see only the caller's own rows on
-- both tables and always report 0. Each returns a bare count, never who.

-- Accepted connections of auth.uid() enrolled in a class ("5 in your circle
-- enrolled"). One enrollment can match at most one connection row (the pair is
-- unique), so the join cannot double-count.
create or replace function public.circle_enrolled_count(p_class_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.class_enrollments ce
  join public.connections c
    on c.status = 'accepted'
   and ((c.requester_id = auth.uid() and c.addressee_id = ce.user_id)
     or (c.addressee_id = auth.uid() and c.requester_id = ce.user_id))
  where ce.class_id = p_class_id;
$$;

grant execute on function public.circle_enrolled_count(uuid) to anon, authenticated;

-- Same shape against applications ("4 in your circle applied").
--
-- (Superseded by projects-saved.sql — the single source of truth. Phase 4b
-- changed the count below to count(distinct a.applicant_id): project-roles.sql
-- §4 dropped applications' unique (project_id, applicant_id), so one applicant
-- can hold one application PER ROLE on a project and the count(*) here counts
-- them twice. That file fixes this function and defines the batched
-- circle_applied_counts(uuid[]) beside it so the two cannot disagree — change
-- the function THERE, not here.)
create or replace function public.circle_applied_count(p_project_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.applications a
  join public.connections c
    on c.status = 'accepted'
   and ((c.requester_id = auth.uid() and c.addressee_id = a.applicant_id)
     or (c.addressee_id = auth.uid() and c.requester_id = a.applicant_id))
  where a.project_id = p_project_id;
$$;

grant execute on function public.circle_applied_count(uuid) to anon, authenticated;


-- ── 8. Row Level Security: connections ──────────────────────────────────────
alter table public.connections enable row level security;

-- Only the two parties ever see the raw row. Everyone else learns about
-- connections exclusively through the scalar helpers above — never from a
-- broader SELECT policy.
drop policy if exists "Parties read own connections" on public.connections;
create policy "Parties read own connections"
  on public.connections for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Request as yourself, always starting 'pending', and only pro-to-pro: the
-- caller via is_approved_pro(), the OTHER party via profile_is_approved_pro()
-- (an inline profiles subquery would run under the caller's RLS — see §4).
-- Fans use follows. The reciprocal case (B→A while A→B exists) is already
-- blocked by the unique pair index, so it is not re-checked here.
drop policy if exists "Approved pros request connections" on public.connections;
create policy "Approved pros request connections"
  on public.connections for insert
  with check (
    requester_id = auth.uid()
    and status = 'pending'
    and public.is_approved_pro()
    and public.profile_is_approved_pro(addressee_id)
  );

-- Only the ADDRESSEE of a still-pending request may update it, and only into
-- 'accepted' with responded_at stamped — so the requester can never accept
-- their own request. Pair immutability is the connections_freeze_pair
-- trigger's job, not this policy's: WITH CHECK cannot see the old row.
drop policy if exists "Addressees accept pending requests" on public.connections;
create policy "Addressees accept pending requests"
  on public.connections for update
  using (addressee_id = auth.uid() and status = 'pending')
  with check (
    addressee_id = auth.uid()
    and status = 'accepted'
    and responded_at is not null
  );

-- Either party may delete: the requester withdraws a pending request, or
-- either side disconnects an accepted one.
drop policy if exists "Parties delete own connections" on public.connections;
create policy "Parties delete own connections"
  on public.connections for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());


-- ── 9. Row Level Security: activity_reactions ───────────────────────────────
alter table public.activity_reactions enable row level security;

-- Reactions follow event visibility exactly, via can_view_event()
-- (comments.sql) — if you can't see the post, you can't see or add to its
-- congratulations.
drop policy if exists "Read reactions on visible events" on public.activity_reactions;
create policy "Read reactions on visible events"
  on public.activity_reactions for select
  using (public.can_view_event(event_id));

drop policy if exists "Members react to visible events" on public.activity_reactions;
create policy "Members react to visible events"
  on public.activity_reactions for insert
  with check (
    actor_id = auth.uid()
    and public.is_member()
    and public.can_view_event(event_id)
  );

-- Toggle off: only your own reaction.
drop policy if exists "Actors delete own reactions" on public.activity_reactions;
create policy "Actors delete own reactions"
  on public.activity_reactions for delete
  using (actor_id = auth.uid());

-- (No UPDATE policy: a reaction is either present or not.)


-- ── 10. Row Level Security: endorsements ────────────────────────────────────
alter table public.endorsements enable row level security;

-- Deliberately readable by ANY member — unlike connections, endorsements are
-- social proof the design surfaces to everyone ("vouched by <name>"), so
-- member-wide SELECT is the point, not a leak.
drop policy if exists "Members read endorsements" on public.endorsements;
create policy "Members read endorsements"
  on public.endorsements for select
  using (public.is_member());

-- Endorse as yourself, pro-to-pro (caller AND subject approved), and only for
-- a skill the subject actually lists (primary role or secondary skills — see
-- profile_lists_skill()).
drop policy if exists "Approved pros endorse listed skills" on public.endorsements;
create policy "Approved pros endorse listed skills"
  on public.endorsements for insert
  with check (
    endorser_id = auth.uid()
    and public.is_approved_pro()
    and public.profile_is_approved_pro(subject_id)
    and public.profile_lists_skill(subject_id, skill)
  );

-- Retract: only your own endorsement.
drop policy if exists "Endorsers delete own endorsements" on public.endorsements;
create policy "Endorsers delete own endorsements"
  on public.endorsements for delete
  using (endorser_id = auth.uid());

-- (No UPDATE policy: re-endorse by delete + insert.)
