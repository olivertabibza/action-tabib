-- ============================================================================
-- Classes & enrollments
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
--
-- Run this ONCE in the Supabase SQL editor, AFTER marketplace.sql, admin.sql,
-- and content.sql: it reuses their security-definer helpers
-- public.is_approved_pro() and public.is_admin(), so those must already exist.
--
-- A class is an EVENT YOU ENROLL IN, not attend — so the shape mirrors events
-- (see content.sql) and its enrollments mirror event RSVPs (see rsvps.sql), with
-- two deliberate differences:
--   * Enrollment is CAPPED (capacity), and the cap is enforced in the INSERT
--     policy so a race can't oversubscribe — the DB is the only place two
--     simultaneous enrolls can't both slip past a check-then-insert in app code.
--   * Classes are PROFESSIONAL-ONLY. Unlike RSVPs (open to any authenticated
--     user, fans included), only approved pros may enroll — enforced in the
--     INSERT policy via public.is_approved_pro().
--
-- As everywhere else in this app, elevated reads/writes come from Row Level
-- Security via the security-definer helpers, NOT from the service-role / secret
-- key. No code under app/ uses the secret key.
-- ============================================================================


-- ── 1. classes ──────────────────────────────────────────────────────────────
-- FK to profiles (not auth.users) so Supabase can embed the instructor's
-- display_name in a single query. profiles.id == the auth user id.
-- discipline reuses the project vocabulary (marketplace.sql: the 8 disciplines
-- plus 'any'); level and format are class-specific. price_cents is DISPLAY-ONLY
-- for now — enrolling is free — but stored in cents so real payments can attach
-- later without a data migration.
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  description text not null default '',
  discipline  text not null default 'any'
    check (discipline in ('actor','writer','director','producer',
                          'cinematographer','editor','composer','any')),
  format      text not null default 'in_person'
    check (format in ('in_person','virtual')),
  venue       text not null default '',          -- "Virtual" reads from format
  level       text not null default 'all'
    check (level in ('beginner','intermediate','advanced','all')),
  price_cents integer not null default 0 check (price_cents >= 0),
  capacity    integer not null default 12 check (capacity > 0),
  starts_at   timestamptz not null,
  status      text not null default 'pending'
    check (status in ('pending','published','rejected')),
  created_at  timestamptz not null default now()
);

create index if not exists classes_starts_at_idx on public.classes (starts_at);
create index if not exists classes_status_idx    on public.classes (status);


-- ── 2. class_enrollments ────────────────────────────────────────────────────
-- One row per (class, user): a pro says "I'm in". The UNIQUE (class_id, user_id)
-- makes an enrollment idempotent and lets the toggle collapse a double-insert
-- race. Mirrors event_rsvps (rsvps.sql).
create table if not exists public.class_enrollments (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id)  on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, user_id)
);

create index if not exists class_enrollments_class_id_idx on public.class_enrollments (class_id);
create index if not exists class_enrollments_user_id_idx  on public.class_enrollments (user_id);


-- ── 3. Row Level Security: classes ──────────────────────────────────────────
-- Mirrors the events policies verbatim in shape: published rows are public;
-- authors see their own drafts; admins see everything; an approved pro creates
-- rows they own (defaulting to 'pending'); authors edit their own and admins
-- update any (that's how publish/reject works).
alter table public.classes enable row level security;

-- Anon needs table-level SELECT to read published rows directly (mirrors the
-- grant in content.sql). The policies below still scope WHICH rows each role
-- sees. Note: the app keeps classes pro-only at the layout level, but the read
-- grant matches events so the model stays identical and future surfacing is free.
grant select on public.classes to anon, authenticated;

drop policy if exists "Anyone reads published classes" on public.classes;
create policy "Anyone reads published classes"
  on public.classes for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Authors read own classes" on public.classes;
create policy "Authors read own classes"
  on public.classes for select
  using (created_by = auth.uid());

drop policy if exists "Admins read all classes" on public.classes;
create policy "Admins read all classes"
  on public.classes for select
  using (public.is_admin());

-- An approved pro can create a class they own. New rows default to 'pending'
-- (the column default); restricting WHICH columns a writer may set lives in the
-- server action, not RLS — same as content.sql.
drop policy if exists "Approved members create own classes" on public.classes;
create policy "Approved members create own classes"
  on public.classes for insert
  with check (created_by = auth.uid() and public.is_approved_pro());

-- The author edits their own; admins update any (to publish / reject).
drop policy if exists "Authors update own classes" on public.classes;
create policy "Authors update own classes"
  on public.classes for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Admins update classes" on public.classes;
create policy "Admins update classes"
  on public.classes for update
  using (public.is_admin())
  with check (public.is_admin());


-- ── 4. Row Level Security: class_enrollments ────────────────────────────────
-- Mirrors event_rsvps, with two tightenings (see the header): authenticated
-- only (no anon grant), and the INSERT policy additionally requires an approved
-- pro AND that the class isn't already full.
alter table public.class_enrollments enable row level security;

-- Only authenticated users touch this table directly. Anon gets NO grant and no
-- policy, so it can never read the raw rows — it only sees aggregate counts via
-- the view below.
grant select, insert, delete on public.class_enrollments to authenticated;

-- Read your own enrollments (to render "Enrolled" state and your class list).
drop policy if exists "Users read own enrollments" on public.class_enrollments;
create policy "Users read own enrollments"
  on public.class_enrollments for select
  to authenticated
  using (user_id = auth.uid());

-- Enroll as yourself, only into a PUBLISHED class, only as an APPROVED PRO, and
-- only while there's room. The capacity check lives HERE, not just in the action,
-- because the database is the only place a check-then-insert race can't slip
-- through: two concurrent enrolls both counting the last free seat can both pass
-- an app-level check, but the policy is evaluated per-row against the committed
-- table state.
--
-- Everything hangs off ONE correlated subquery over public.classes (aliased c),
-- deliberately. `class_id` here is the class_id of the row being inserted — and
-- it can only mean that because c (classes) has no `class_id` column to shadow
-- it. (If we instead wrote `where e.class_id = class_id` inside a subquery that
-- selects `from public.class_enrollments e`, the bare `class_id` would bind to
-- e.class_id and the count would silently span the WHOLE table.) The inner count
-- correlates to c.id, which is unambiguous.
drop policy if exists "Approved pros enroll in published classes" on public.class_enrollments;
create policy "Approved pros enroll in published classes"
  on public.class_enrollments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_approved_pro()
    and exists (
      select 1 from public.classes c
      where c.id = class_id
        and c.status = 'published'
        and (
          select count(*) from public.class_enrollments e
          where e.class_id = c.id
        ) < c.capacity
    )
  );

-- Cancel your own enrollment (frees a seat).
drop policy if exists "Users delete own enrollments" on public.class_enrollments;
create policy "Users delete own enrollments"
  on public.class_enrollments for delete
  to authenticated
  using (user_id = auth.uid());

-- (No UPDATE policy: an enrollment is either present or not.)


-- ── 5. Public enrollment counts ─────────────────────────────────────────────
-- A SECURITY-DEFINER view (security_invoker = false, the default) runs as the
-- view owner, bypassing class_enrollments' RLS. That lets everyone read the
-- aggregate head-count ("X of Y spots left") without exposing WHO enrolled.
-- Copies event_rsvp_counts (rsvps.sql) exactly.
drop view if exists public.class_enrollment_counts;
create view public.class_enrollment_counts
  with (security_invoker = false) as
  select class_id, count(*)::bigint as enrolled_count
  from public.class_enrollments
  group by class_id;

grant select on public.class_enrollment_counts to anon, authenticated;
