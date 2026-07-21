-- ============================================================================
-- Social feed (following-based)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
--
-- This is the Phase 2 social core. Per docs/VISION.md the network is
-- FOLLOWING-BASED — a one-way "follow", not a mutual/bidirectional connection.
-- One member follows another; the followed member does not have to follow back.
--
-- Two tables:
--   * follows         — who follows whom (one row per directed edge).
--   * activity_events — the feed. Designed to hold every future activity kind,
--                       but only two fire today: 'status_update' (you posted an
--                       update) and 'started_following' (you followed someone).
--
-- As everywhere else in this app, elevated reads/writes come from Row Level
-- Security via security-definer helpers (is_approved_pro(), is_following()),
-- NOT from the service-role / secret key. No code under app/ uses the secret key.
-- ============================================================================


-- ── 1. follows ──────────────────────────────────────────────────────────────
-- A directed edge: follower_id follows following_id. The composite primary key
-- makes a follow idempotent (you can't follow the same person twice) and the
-- CHECK stops anyone following themselves. FKs point at profiles (profiles.id ==
-- the auth user id) so the network list can embed display_name + role directly.
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_follower_id_idx  on public.follows (follower_id);
create index if not exists follows_following_id_idx on public.follows (following_id);


-- ── 2. activity_events ──────────────────────────────────────────────────────
-- The feed. `kind` is constrained to the full set of activity kinds we expect to
-- add over Phase 2/3 (classes, bookings, project posts), but the INSERT policy
-- below only lets members write the two that exist today.
--   * body       — free text for a 'status_update'.
--   * subject_id — the OTHER party/object an event is about: the followed
--                  person for 'started_following', a project id later. It is
--                  deliberately NOT a foreign key, since it points at different
--                  tables depending on `kind`.
--   * metadata   — denormalized display bits so the feed renders without extra
--                  joins (e.g. the followed person's name for 'started_following').
create table if not exists public.activity_events (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  kind       text not null
    check (kind in ('status_update','started_following',
                    'class_enrolled','project_booked','project_posted')),
  body       text not null default '',
  subject_id uuid,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_actor_id_idx   on public.activity_events (actor_id);
create index if not exists activity_events_created_at_idx  on public.activity_events (created_at desc);


-- ── 3. Row Level Security ───────────────────────────────────────────────────
alter table public.follows         enable row level security;
alter table public.activity_events enable row level security;

-- Helper: does the current user follow `target`? security definer so it can read
-- follows without tripping that table's own RLS (the activity_events SELECT
-- policy calls this, which would otherwise recurse follows → events → follows …).
create or replace function public.is_following(target uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.follows f
    where f.follower_id = auth.uid()
      and f.following_id = target
  );
$$;


-- ── 4. RLS: follows ─────────────────────────────────────────────────────────

-- Read any edge you're part of (either side) — lets a profile show follower
-- counts and a "you follow them" state.
drop policy if exists "Read follows you are part of" on public.follows;
create policy "Read follows you are part of"
  on public.follows for select
  using (follower_id = auth.uid() or following_id = auth.uid());

-- (The follows INSERT policy lives in fan-follows.sql — the single source of
-- truth. It widened this from pros-only to any member so fans can follow too;
-- defining it here as well would let the two files diverge on the live DB.)

-- Unfollow: you can only delete your own outgoing follow.
drop policy if exists "Unfollow your own" on public.follows;
create policy "Unfollow your own"
  on public.follows for delete
  using (follower_id = auth.uid());

-- (No UPDATE policy: a follow is immutable — you follow or you don't.)


-- ── 5. RLS: activity_events ─────────────────────────────────────────────────

-- Your feed is yourself plus everyone you follow.
drop policy if exists "Read self and followed activity" on public.activity_events;
create policy "Read self and followed activity"
  on public.activity_events for select
  using (actor_id = auth.uid() or public.is_following(actor_id));

-- Only an approved member can post, only as themselves, and only the two kinds
-- that exist today. Future kinds stay write-blocked until their feature ships.
drop policy if exists "Approved members post activity" on public.activity_events;
create policy "Approved members post activity"
  on public.activity_events for insert
  with check (
    actor_id = auth.uid()
    and public.is_approved_pro()
    and kind in ('status_update','started_following')
  );

-- (No UPDATE/DELETE policy: feed events are an immutable, append-only log.)
