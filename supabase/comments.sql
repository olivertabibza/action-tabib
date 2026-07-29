-- ============================================================================
-- Feed comments (one level of replies, Instagram-style)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
-- Additive and forward-only: nothing here alters existing tables or policies.
--
-- Comments hang off activity_events (supabase/social-feed.sql) and follow
-- event visibility EXACTLY: if you can't see the event, you can't see or
-- write its comments. That boundary is enforced here in the database — the
-- can_view_event() helper mirrors the live activity_events SELECT policy
-- ("Read self and followed activity": actor_id = auth.uid() OR
-- is_following(actor_id)) — not in the UI.
--
-- Threading is ONE level deep: a top-level comment (parent_id null) can have
-- replies, but a reply can never be a parent. comment_is_top_level() enforces
-- that at the database layer via the INSERT policy.
--
-- As everywhere else in this app, elevated reads come from Row Level Security
-- via security-definer helpers, NOT from the service-role / secret key.
-- ============================================================================


-- ── 1. activity_comments ────────────────────────────────────────────────────
-- One row per comment. parent_id null = top-level; non-null = a reply to that
-- top-level comment. Deleting an event or a parent comment cascades, so a
-- removed post (or top-level comment) takes its whole thread with it.
create table if not exists public.activity_comments (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.activity_events (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  parent_id  uuid references public.activity_comments (id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists activity_comments_event_id_idx  on public.activity_comments (event_id);
create index if not exists activity_comments_parent_id_idx on public.activity_comments (parent_id);


-- ── 2. Helpers ──────────────────────────────────────────────────────────────

-- Can the current user see this event? Mirrors the activity_events SELECT
-- policy ("Read self and followed activity") exactly. security definer so it
-- can read activity_events without re-entering that table's RLS from inside
-- the activity_comments policies.
create or replace function public.can_view_event(eid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.activity_events e
    where e.id = eid
      and (e.actor_id = auth.uid() or public.is_following(e.actor_id))
  );
$$;

-- Is this comment top-level (parent_id null)? Used by the INSERT policy so a
-- reply can only ever target a top-level comment — one level of nesting,
-- enforced in the database. security definer so the check doesn't recurse
-- through activity_comments' own SELECT policy.
create or replace function public.comment_is_top_level(cid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.activity_comments c
    where c.id = cid
      and c.parent_id is null
  );
$$;


-- ── 3. Row Level Security ───────────────────────────────────────────────────
alter table public.activity_comments enable row level security;

-- Read: exactly the events you can read.
drop policy if exists "Read comments on visible events" on public.activity_comments;
create policy "Read comments on visible events"
  on public.activity_comments for select
  using (public.can_view_event(event_id));

-- Write: only as yourself, only on events you can see, and a reply may only
-- target a top-level comment (never another reply).
drop policy if exists "Comment on visible events" on public.activity_comments;
create policy "Comment on visible events"
  on public.activity_comments for insert
  with check (
    author_id = auth.uid()
    and public.can_view_event(event_id)
    and (parent_id is null or public.comment_is_top_level(parent_id))
  );

-- Delete: only your own comments. Deleting a top-level comment cascades its
-- replies via the parent_id FK.
drop policy if exists "Delete your own comments" on public.activity_comments;
create policy "Delete your own comments"
  on public.activity_comments for delete
  using (author_id = auth.uid());

-- (No UPDATE policy: no comment editing in v1.)
