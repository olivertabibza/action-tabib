-- ============================================================================
-- Class reviews & ratings
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
--
-- Run this ONCE in the Supabase SQL editor, AFTER classes.sql and
-- fan-follows.sql: it reuses the security-definer helpers
-- public.is_approved_pro() and public.is_admin() (created by classes.sql's own
-- prerequisites) and reads public.class_enrollments (classes.sql); the
-- "reviews from your connections" ordering on the class page reads follows,
-- whose policies fan-follows.sql finalizes.
--
-- One review per person per class, and ONLY people who actually enrolled may
-- write one — enforced here in RLS via the security-definer helper
-- public.is_enrolled(), for the same reason classes.sql uses
-- class_seats_taken(): a policy subquery over class_enrollments runs under the
-- CALLER's RLS. See the note on is_enrolled() in §2.
--
-- As everywhere else in this app, elevated reads/writes come from Row Level
-- Security via the security-definer helpers, NOT from the service-role / secret
-- key. No code under app/ uses the secret key.
-- ============================================================================


-- ── 1. class_reviews ────────────────────────────────────────────────────────
-- FK to profiles (not auth.users) so Supabase can embed the reviewer's
-- display_name + role in a single query, same as classes.created_by. The
-- UNIQUE (class_id, reviewer_id) makes a review an upsert target: submitting
-- again edits your existing review instead of stacking a second one.
create table if not exists public.class_reviews (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id)  on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  body        text not null default '',
  created_at  timestamptz not null default now(),
  unique (class_id, reviewer_id)
);

create index if not exists class_reviews_class_id_idx on public.class_reviews (class_id);


-- ── 2. is_enrolled() ────────────────────────────────────────────────────────
-- Is the CALLER enrolled in this class? Used by the INSERT policy below.
--
-- security definer for the same reason class_seats_taken() is (classes.sql §4):
-- an inline subquery over class_enrollments inside a policy is evaluated under
-- the caller's own RLS. Today the caller CAN see their own enrollment row
-- ("Users read own enrollments"), so an inline check would happen to work —
-- but the definer helper keeps this policy correct even if that SELECT policy
-- ever changes, and matches every other helper's shape. It leaks nothing:
-- callers get a boolean about THEMSELVES only.
create or replace function public.is_enrolled(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.class_enrollments e
    where e.class_id = p_class_id
      and e.user_id  = auth.uid()
  );
$$;

revoke execute on function public.is_enrolled(uuid) from public;
grant execute on function public.is_enrolled(uuid) to authenticated;


-- ── 3. Row Level Security: class_reviews ────────────────────────────────────
-- FORCE so even the table owner goes through the policies — reviews carry no
-- path that should ever bypass them (the seed writes via the service role,
-- which has BYPASSRLS, so seeding is unaffected).
alter table public.class_reviews enable row level security;
alter table public.class_reviews force row level security;

-- Authenticated only: classes are a pro-only surface (see classes/layout.tsx),
-- so unlike classes itself there is no anon grant — nothing anon-facing reads
-- reviews.
grant select, insert, update, delete on public.class_reviews to authenticated;

-- Read reviews on any PUBLISHED class, plus always your own review, plus
-- admins see everything (e.g. reviews on a class that was later unpublished).
-- The published check is a plain inline subquery — safe here, unlike the
-- enrollment count, because "Anyone reads published classes" (classes.sql §3)
-- makes published rows visible to every caller.
drop policy if exists "Reviews on published classes are readable" on public.class_reviews;
create policy "Reviews on published classes are readable"
  on public.class_reviews for select
  to authenticated
  using (
    reviewer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.classes c
      where c.id = class_id
        and c.status = 'published'
    )
  );

-- Only someone who ENROLLED in the class may review it, only as themselves.
-- Only pros can enroll, so fans are excluded transitively — but the
-- is_approved_pro() check stays explicit so this policy doesn't silently
-- widen if enrollment rules ever do.
drop policy if exists "Enrolled pros review their class" on public.class_reviews;
create policy "Enrolled pros review their class"
  on public.class_reviews for insert
  to authenticated
  with check (
    reviewer_id = auth.uid()
    and public.is_approved_pro()
    and public.is_enrolled(class_id)
  );

-- Edit your own review only (the app's "submit again to update" upsert lands
-- here on the conflict path).
drop policy if exists "Reviewers update own review" on public.class_reviews;
create policy "Reviewers update own review"
  on public.class_reviews for update
  to authenticated
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid());

-- Delete your own review; admins can remove any (moderation).
drop policy if exists "Reviewers and admins delete reviews" on public.class_reviews;
create policy "Reviewers and admins delete reviews"
  on public.class_reviews for delete
  to authenticated
  using (reviewer_id = auth.uid() or public.is_admin());
