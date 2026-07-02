-- ============================================================================
-- Event RSVPs
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
--
-- Run this ONCE in the Supabase SQL editor, AFTER content.sql (it references
-- public.events).
--
-- One row per (event, user): a member says "I'm going". Any AUTHENTICATED user
-- may RSVP — fans and pros alike — but only to a PUBLISHED event, and only as
-- themselves. Attendee COUNTS are public (anon included) via a security-definer
-- view, while the raw rows (who is going) stay private to each user.
--
-- As everywhere else in this app, elevated reads come from Row Level Security /
-- a security-definer view, NOT from the service-role / secret key. No code under
-- app/ uses the secret key.
-- ============================================================================


-- ── 1. event_rsvps ──────────────────────────────────────────────────────────
-- FKs point at public.events and public.profiles (profiles.id == the auth user
-- id). The UNIQUE (event_id, user_id) makes an RSVP idempotent — you can't RSVP
-- the same event twice — and lets the toggle collapse a double-insert race.
create table if not exists public.event_rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id)   on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_rsvps_event_id_idx on public.event_rsvps (event_id);
create index if not exists event_rsvps_user_id_idx  on public.event_rsvps (user_id);


-- ── 2. Row Level Security ───────────────────────────────────────────────────
alter table public.event_rsvps enable row level security;

-- Only authenticated users touch this table directly. Anon gets NO grant and no
-- policy, so it can never read the raw rows — it only sees aggregate counts via
-- the view below.
grant select, insert, delete on public.event_rsvps to authenticated;

-- Read your own RSVPs (to render "Going" state and your event list).
drop policy if exists "Users read own rsvps" on public.event_rsvps;
create policy "Users read own rsvps"
  on public.event_rsvps for select
  to authenticated
  using (user_id = auth.uid());

-- RSVP as yourself, and only to a published event. The EXISTS runs under the
-- caller's RLS on events, where published rows are readable, so this holds for
-- any authenticated user.
drop policy if exists "Users rsvp to published events" on public.event_rsvps;
create policy "Users rsvp to published events"
  on public.event_rsvps for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'published'
    )
  );

-- Cancel your own RSVP.
drop policy if exists "Users delete own rsvps" on public.event_rsvps;
create policy "Users delete own rsvps"
  on public.event_rsvps for delete
  to authenticated
  using (user_id = auth.uid());

-- (No UPDATE policy: an RSVP is either present or not.)


-- ── 3. Public attendee counts ───────────────────────────────────────────────
-- A SECURITY-DEFINER view (security_invoker = false, the default) runs as the
-- view owner, which bypasses event_rsvps' RLS. That lets EVERYONE — anon fans
-- included — read the aggregate head-count without exposing WHO is going.
drop view if exists public.event_rsvp_counts;
create view public.event_rsvp_counts
  with (security_invoker = false) as
  select event_id, count(*)::bigint as rsvp_count
  from public.event_rsvps
  group by event_id;

grant select on public.event_rsvp_counts to anon, authenticated;
