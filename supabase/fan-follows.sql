-- ============================================================================
-- Fan follows — widen who may create a follow edge
-- ----------------------------------------------------------------------------
-- Safe to run more than once (create or replace / drop-then-create).
--
-- Run this ONCE in the Supabase SQL editor, AFTER social-feed.sql.
--
-- social-feed.sql originally let ONLY approved pros insert a follow edge
-- ("Approved members follow"). The Fan app ships a follow-only feed, which needs
-- fans (consumers) to be able to follow people too. This migration replaces the
-- INSERT policy so ANY member with a profile — an approved pro OR a consumer —
-- can follow, still only as themselves. SELECT/DELETE on follows are unchanged.
--
-- Additive and forward-only (mirrors content-review.sql): social-feed.sql is
-- left as-is, so run this file AFTER it. As everywhere else, the elevated read
-- comes from a security-definer helper, NOT the service-role / secret key.
-- ============================================================================

-- Helper: is the caller a member allowed to follow? An approved professional, or
-- any consumer. security definer so it can read the caller's profile without
-- tripping profiles' own RLS (same shape as is_approved_pro() / is_following()).
create or replace function public.is_member()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        (p.account_type = 'professional' and public.is_approved_pro())
        or p.account_type = 'consumer'
      )
  );
$$;

-- Replace the pros-only INSERT policy with a member-wide one.
drop policy if exists "Approved members follow" on public.follows;
create policy "Members follow"
  on public.follows for insert
  with check (follower_id = auth.uid() and public.is_member());
