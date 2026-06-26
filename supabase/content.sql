-- ============================================================================
-- Events & Articles (Explore content)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
--
-- Run this ONCE in the Supabase SQL editor, AFTER marketplace.sql and admin.sql:
-- it reuses their security-definer helpers public.is_approved_pro() and
-- public.is_admin(), so those must already exist.
--
-- The content model mirrors the marketplace (see marketplace.sql):
--   * Approved pros author events and articles; new rows start as 'pending'.
--   * An admin flips status to 'published' (same approval shape as applications).
--   * PUBLISHED rows are public — readable by EVERYONE, including logged-out
--     fans and anon visitors — the way public-profiles.sql opens approved pros.
--
-- As everywhere else in this app, elevated reads/writes come from Row Level
-- Security via the security-definer helpers, NOT from the service-role / secret
-- key. No code under app/ uses the secret key.
-- ============================================================================


-- ── 1. events ───────────────────────────────────────────────────────────────
-- FK to profiles (not auth.users) so Supabase can embed the host's display_name
-- in a single query. profiles.id == the auth user id.
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  description text not null default '',
  venue       text not null default '',          -- "Virtual" allowed
  event_type  text not null default 'screening'
    check (event_type in ('screening','q_and_a','panel','festival','mixer')),
  starts_at   timestamptz not null,
  status      text not null default 'pending'
    check (status in ('pending','published')),
  created_at  timestamptz not null default now()
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_status_idx    on public.events (status);


-- ── 2. articles ─────────────────────────────────────────────────────────────
create table if not exists public.articles (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  category    text not null default 'interview'
    check (category in ('interview','craft','scene_report','news')),
  excerpt     text not null default '',
  body        text not null default '',
  status      text not null default 'pending'
    check (status in ('pending','published')),
  created_at  timestamptz not null default now()
);

create index if not exists articles_status_idx     on public.articles (status);
create index if not exists articles_created_at_idx on public.articles (created_at desc);


-- ── 3. Row Level Security ───────────────────────────────────────────────────
alter table public.events   enable row level security;
alter table public.articles enable row level security;

-- Anon needs table-level SELECT to read published rows directly (mirrors the
-- grant in public-profiles.sql). The RLS policies below still scope WHICH rows
-- each role can see.
grant select on public.events   to anon, authenticated;
grant select on public.articles to anon, authenticated;

-- events: published rows are public; authors see their own drafts; admins see
-- everything. (Policies are OR'd together.)
drop policy if exists "Anyone reads published events" on public.events;
create policy "Anyone reads published events"
  on public.events for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Authors read own events" on public.events;
create policy "Authors read own events"
  on public.events for select
  using (created_by = auth.uid());

drop policy if exists "Admins read all events" on public.events;
create policy "Admins read all events"
  on public.events for select
  using (public.is_admin());

-- events: an approved pro can create an event they own. New rows default to
-- 'pending' (the column default); restricting WHICH columns a writer may set
-- lives in the server action, not in RLS — same as admin.sql.
drop policy if exists "Approved members create own events" on public.events;
create policy "Approved members create own events"
  on public.events for insert
  with check (created_by = auth.uid() and public.is_approved_pro());

-- events: the author edits their own; admins update any (to publish).
drop policy if exists "Authors update own events" on public.events;
create policy "Authors update own events"
  on public.events for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Admins update events" on public.events;
create policy "Admins update events"
  on public.events for update
  using (public.is_admin())
  with check (public.is_admin());


-- articles: same three-policy read shape as events.
drop policy if exists "Anyone reads published articles" on public.articles;
create policy "Anyone reads published articles"
  on public.articles for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Authors read own articles" on public.articles;
create policy "Authors read own articles"
  on public.articles for select
  using (created_by = auth.uid());

drop policy if exists "Admins read all articles" on public.articles;
create policy "Admins read all articles"
  on public.articles for select
  using (public.is_admin());

-- articles: an approved pro can post an article they own (defaults to 'pending').
drop policy if exists "Approved members create own articles" on public.articles;
create policy "Approved members create own articles"
  on public.articles for insert
  with check (created_by = auth.uid() and public.is_approved_pro());

-- articles: the author edits their own; admins update any (to publish).
drop policy if exists "Authors update own articles" on public.articles;
create policy "Authors update own articles"
  on public.articles for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Admins update articles" on public.articles;
create policy "Admins update articles"
  on public.articles for update
  using (public.is_admin())
  with check (public.is_admin());
