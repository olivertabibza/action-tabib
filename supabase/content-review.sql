-- ============================================================================
-- Content review — allow a 'rejected' status on events & articles
-- ----------------------------------------------------------------------------
-- Safe to run more than once (drop-then-create on the constraints).
--
-- Run this ONCE in the Supabase SQL editor, AFTER content.sql.
--
-- content.sql defines each status column with an INLINE, unnamed CHECK:
--   status text not null default 'pending' check (status in ('pending','published'))
-- Postgres auto-names that constraint "<table>_status_check". This migration
-- widens both to also allow 'rejected', so an admin can turn a submission down
-- instead of leaving it pending forever. No new tables and no policy changes:
-- the existing RLS already lets approved pros insert their own pending rows and
-- admins update any row (see content.sql).
-- ============================================================================

alter table public.events
  drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check
  check (status in ('pending','published','rejected'));

alter table public.articles
  drop constraint if exists articles_status_check;
alter table public.articles
  add constraint articles_status_check
  check (status in ('pending','published','rejected'));
