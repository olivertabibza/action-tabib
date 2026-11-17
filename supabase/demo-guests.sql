-- ============================================================================
-- Demo guests: live-event guest accounts
-- ----------------------------------------------------------------------------
-- Safe to run more than once (if not exists / create or replace).
--
-- Run this in the Supabase SQL editor AFTER platform-settings.sql (demo_mode)
-- and BEFORE status-guards.sql, profile-privacy.sql, public-profiles.sql and
-- search.sql, which all use profiles.is_demo_guest.
--
-- A guest scans a QR code that opens /demo. While platform_settings.demo_mode
-- is on, that route signs them in with Supabase anonymous sign-in and inserts
-- their profile. Every privileged value on that profile is set by
-- profiles_guard_privileged (status-guards.sql), never by the client:
--   * an anonymous caller's new profile is an approved professional named
--     "Guest N", marked is_demo_guest and pre-filled with the sample details
--     below, but only while demo_mode is on; while it is off the insert fails;
--   * a non-anonymous caller's profile is never a guest;
--   * is_demo_guest is locked on update, like is_admin;
--   * a new guest follows every approved member, so its Feed isn't empty.
--
-- Guests stay in public_profiles (so /profile/<id> links and bylines work) but
-- are left out of browsing lists: People, Feed suggestions, pro and fan
-- Explore, and global_search.
--
-- Remove them all after the event with
-- supabase/one-off/2026-11-19-remove-demo-guests.sql.
-- ============================================================================


-- ── 1. The guest flag ───────────────────────────────────────────────────────
-- profile-privacy.sql grants SELECT on it; run that file after this one.
alter table public.profiles
  add column if not exists is_demo_guest boolean not null default false;


-- ── 2. Guest numbering ──────────────────────────────────────────────────────
-- Nobody gets the sequence directly; demo_guest_profile() below draws from it.
create sequence if not exists public.demo_guest_seq;
revoke all on sequence public.demo_guest_seq from public, anon, authenticated;


-- ── 3. Is demo mode on? ─────────────────────────────────────────────────────
-- Security definer so it can be read by anyone, even though only admins can
-- SELECT platform_settings. anon needs it: /demo checks it before creating an
-- account, so a scan while demo mode is off creates nothing.
create or replace function public.demo_mode_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select s.demo_mode from public.platform_settings s where s.id), false);
$$;

revoke execute on function public.demo_mode_enabled() from public;
grant execute on function public.demo_mode_enabled() to anon, authenticated, service_role;


-- ── 4. A new guest's name and sample details ────────────────────────────────
-- Takes the next number and rotates through six sample profiles, so a guest's
-- own Profile tab isn't empty. Security definer for nextval. Callable by any
-- signed-in user (the guard trigger runs as the inserting user); calling it
-- directly only uses up a number.
create or replace function public.demo_guest_profile()
returns table (display_name text, role text, skills text[], headline text, bio text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n bigint := nextval('public.demo_guest_seq');
begin
  return query
  select 'Guest ' || n, s.role, array[s.role, s.extra], s.headline, s.bio
  from (values
    (0, 'actor', 'writer',
     'Actor, stage-trained and moving into screen work',
     'Ten years of fringe theatre and two short films. Looking for character-led indie projects and a good scene partner for self-tapes.'),
    (1, 'cinematographer', 'videographer',
     'Cinematographer who loves available light',
     'Shot three shorts and a lot of music videos on a small crew. Happiest with handheld, practical lights and a director who likes rehearsal.'),
    (2, 'editor', 'sound_designer',
     'Editor for documentaries and slow-burn drama',
     'Cutting long-form documentary by day and shorts by night. I like finding the story in the footage you almost threw away.'),
    (3, 'writer', 'director',
     'Screenwriter working on a first feature',
     'Writing contained, dialogue-led stories set in small towns. Looking for a producer and a table read for my latest draft.'),
    (4, 'composer', 'sound_designer',
     'Composer for film, games and theatre',
     'Piano and strings, with an electronic edge when the scene wants it. Scored four shorts last year and always up for a temp-track conversation.'),
    (5, 'producer', 'director',
     'Producer who gets small films finished',
     'Budgets, schedules, permits and the occasional catering run. Two shorts in festivals this year; building a slate of low-budget features.')
  ) as s(i, role, extra, headline, bio)
  where s.i = n % 6;
end;
$$;

revoke execute on function public.demo_guest_profile() from public, anon;
grant execute on function public.demo_guest_profile() to authenticated, service_role;


-- ── 5. A new guest follows the members ──────────────────────────────────────
-- The Feed shows only your own posts and the people you follow
-- ("Read self and followed activity", social-feed.sql). A new guest follows
-- nobody, so every guest landed on "Your feed is quiet". The moment a guest's
-- profile is created it now follows every approved member (no admins, no other
-- guests), so the Feed is full from the first screen.
--
-- After insert, because the follows rows need the profile to exist (FK). The
-- WHEN clause reads is_demo_guest as profiles_guard_privileged left it, so a
-- client can never trigger this for a real account. Security definer so the
-- insert doesn't depend on the guest's own follows policy; nothing is
-- returned to the caller. The rows go with the guest (ON DELETE CASCADE) when
-- the cleanup script removes guests.
create or replace function public.demo_guest_follow_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.follows (follower_id, following_id)
  select new.id, p.id
  from public.profiles p
  where p.account_type = 'professional'
    and p.application_status = 'approved'
    and not p.is_admin
    and not p.is_demo_guest
    and p.id <> new.id
  on conflict do nothing;
  return null;
end;
$$;

revoke execute on function public.demo_guest_follow_members() from public, anon, authenticated;

drop trigger if exists profiles_demo_guest_follows on public.profiles;
create trigger profiles_demo_guest_follows
  after insert on public.profiles
  for each row when (new.is_demo_guest)
  execute function public.demo_guest_follow_members();
