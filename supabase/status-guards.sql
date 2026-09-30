-- ============================================================================
-- Status & privilege guards (Phase 1a)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (create or replace / drop-then-create). Additive:
-- no tables, columns or policies change.
--
-- Run this ONCE in the Supabase SQL editor, AFTER marketplace.sql
-- (profiles.application_status), admin.sql (is_admin, profiles.is_admin),
-- content.sql + content-review.sql (events, articles) and classes.sql.
--
-- Why: RLS decides WHICH ROWS a caller may write, never WHICH COLUMNS. So
--   * "Users can insert / update their own profile" let any signed-in user set
--     their own is_admin = true or application_status = 'approved';
--   * "Approved members create own …" and "Authors update own …" let any
--     approved pro create or edit its own class, event or article straight to
--     status = 'published', skipping review.
-- Both were proven live by tests/rls/status-guards.test.ts before this file.
-- The fix follows projects_guard_staff_pick (project-roles.sql): a BEFORE
-- trigger, the only place the old value can be restored, since WITH CHECK
-- never sees OLD.
--
-- Two callers may still set these columns:
--   * an admin, via is_admin() (admin.sql) — the /admin approve/publish actions;
--   * a trusted backend context with NO end user attached — auth.uid() is null
--     there, which covers scripts/seed.ts (service role) and hand-run SQL such
--     as admin.sql's bootstrap.
-- The null-uid arm is not a hole: anon also has a null auth.uid(), but every
-- INSERT/UPDATE policy on these four tables requires id = auth.uid(),
-- created_by = auth.uid() or is_admin(), so an anon caller can never get a row
-- as far as these triggers.
-- ============================================================================


-- ── 1. profiles: is_admin and application_status are admin-only ─────────────
-- A new profile always starts as a non-admin, pending applicant — the same
-- values onboarding already sends, so the signup flow is unaffected. On UPDATE
-- both columns are put back to their stored values; every other column
-- (display_name, headline, bio, …) stays editable by its owner.
create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_admin := false;
    new.application_status := 'pending';
  else
    new.is_admin := old.is_admin;
    new.application_status := old.application_status;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_privileged();


-- ── 2. classes / events / articles: status is admin-only ────────────────────
-- One function for all three tables: each has the same status column with the
-- same meaning ('pending' → admin review → 'published' / 'rejected'). A new
-- row always enters the review queue; an author's edit never moves it.
create or replace function public.content_guard_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
  else
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists classes_guard_status on public.classes;
create trigger classes_guard_status
  before insert or update on public.classes
  for each row execute function public.content_guard_status();

drop trigger if exists events_guard_status on public.events;
create trigger events_guard_status
  before insert or update on public.events
  for each row execute function public.content_guard_status();

drop trigger if exists articles_guard_status on public.articles;
create trigger articles_guard_status
  before insert or update on public.articles
  for each row execute function public.content_guard_status();
