-- ============================================================================
-- Multi-discipline projects + profile skills
-- ----------------------------------------------------------------------------
-- Additive, idempotent, forward-only. Run AFTER marketplace.sql, classes.sql,
-- and public-profiles.sql. Safe to run more than once.
--
-- Expanded discipline vocabulary (mirrors DISCIPLINES in lib/marketplace.ts):
--   actor, writer, director, producer, cinematographer, videographer,
--   editor, composer, sound_designer, sound_operator, costume_designer,
--   makeup_artist                       — plus 'any' for projects/classes only.
--
-- Constraint names below were verified against the LIVE database on
-- 2026-07-29 (check-violation probes named "projects_discipline_check" and
-- "classes_discipline_check"; profiles.role accepted arbitrary text, so it has
-- no check constraint and is left as free text).
-- ============================================================================


-- ── 1. projects.disciplines (multi-role) ────────────────────────────────────
alter table public.projects
  add column if not exists disciplines text[] not null default '{}';

-- Backfill from the legacy single-value column. Only touches rows that still
-- have the empty-array default, so re-running never clobbers real data.
update public.projects
   set disciplines = array[discipline]
 where disciplines = '{}'::text[];

-- Retire the old single-value check (verified name, see header). The legacy
-- `discipline` column stays and keeps being written as disciplines[1] by the
-- app for backward compatibility, but is no longer constrained.
alter table public.projects
  drop constraint if exists projects_discipline_check;

-- New check: non-empty, and every entry drawn from the expanded set + 'any'.
alter table public.projects
  drop constraint if exists projects_disciplines_check;
alter table public.projects
  add constraint projects_disciplines_check
  check (
    disciplines <> '{}'
    and disciplines <@ array[
      'actor','writer','director','producer','cinematographer','videographer',
      'editor','composer','sound_designer','sound_operator',
      'costume_designer','makeup_artist','any'
    ]::text[]
  );


-- ── 2. profiles.skills ──────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists skills text[] not null default '{}';

-- Skills use the same vocabulary WITHOUT 'any'. Empty array is allowed.
alter table public.profiles
  drop constraint if exists profiles_skills_check;
alter table public.profiles
  add constraint profiles_skills_check
  check (
    skills <@ array[
      'actor','writer','director','producer','cinematographer','videographer',
      'editor','composer','sound_designer','sound_operator',
      'costume_designer','makeup_artist'
    ]::text[]
  );

-- profiles.role: verified free text with NO db-level check constraint (live
-- values are title-cased legacy strings like 'Editor'), so it is left as-is.


-- ── 3. classes: widen the single-discipline check ───────────────────────────
-- The class form shares the same vocabulary (PROJECT_DISCIPLINES), so the
-- old 8-value check would reject the new disciplines at class creation.
alter table public.classes
  drop constraint if exists classes_discipline_check;
alter table public.classes
  add constraint classes_discipline_check
  check (
    discipline in (
      'actor','writer','director','producer','cinematographer','videographer',
      'editor','composer','sound_designer','sound_operator',
      'costume_designer','makeup_artist','any'
    )
  );


-- ── 4. public_profiles view: expose skills ──────────────────────────────────
-- Same shape as supabase/public-profiles.sql with `skills` appended (create or
-- replace view only allows appending columns). Same fixed filter, same public-
-- safe column set, same grants — email etc. stay private.
create or replace view public.public_profiles as
  select id, display_name, role, headline, bio, portfolio_files, skills
  from public.profiles
  where account_type = 'professional'
    and application_status = 'approved';

grant select on public.public_profiles to anon, authenticated;
