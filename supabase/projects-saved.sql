-- ============================================================================
-- Saved projects + batched circle-applied counts (Callboard Phase 4b)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses drop-then-create / create or
-- replace). Forward-only: it redefines one policy and one existing function
-- and adds one new one, and changes no table, column or constraint.
--
-- Run this ONCE in the Supabase SQL editor, AFTER saved-items.sql (the policy
-- it redefines), project-roles.sql (can_view_project, and the item_type check
-- that already accepts 'project') and connections.sql (circle_applied_count,
-- which it redefines).
--
-- What the Projects design (design/handoff/README.md §2) needs and this adds:
--   * the bookmark icon        → a third arm on the saved_items INSERT policy
--   * "N in your circle applied"
--     on a PAGE of project cards → public.circle_applied_counts(uuid[])
--   * …counting PEOPLE, not rows → both circle-applied helpers now count
--     distinct applicants (see §2)
--
-- As everywhere else in this app, elevated reads come from Row Level Security
-- via security-definer helpers, NOT from the service-role / secret key.
-- ============================================================================


-- ── 1. saved_items: the third arm ───────────────────────────────────────────
-- project-roles.sql §5 widened saved_items.item_type to accept 'project', but
-- the INSERT policy branches on 'event' and 'article' with NO else, so a
-- project save is still rejected by the policy. This is the missing arm.
--
-- It gates on VISIBILITY, not existence: can_view_project() mirrors the
-- projects SELECT policy, so a member cannot bookmark a project they are not
-- permitted to read (a pending pro, or anyone, against a closed project that
-- isn't theirs). Existence alone would leak that a project id is real.
--
-- can_view_project() is already security definer (project-roles.sql §6), so
-- this does NOT re-enter projects' own RLS from inside a policy — the mistake
-- called out at the top of connections.sql §7.
--
-- Drop-then-create with BOTH existing arms kept VERBATIM: Postgres has no
-- "add a branch to a policy", so the whole expression is restated. This file
-- is now the single source of truth for this policy; saved-items.sql carries a
-- pointer comment saying so, the same convention social-feed.sql uses to point
-- at fan-follows.sql.
drop policy if exists "Users save published items" on public.saved_items;
create policy "Users save published items"
  on public.saved_items for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      (
        item_type = 'event'
        and exists (
          select 1 from public.events e
          where e.id = item_id and e.status = 'published'
        )
      )
      or (
        item_type = 'article'
        and exists (
          select 1 from public.articles a
          where a.id = item_id and a.status = 'published'
        )
      )
      or (
        item_type = 'project'
        and public.can_view_project(item_id)
      )
    )
  );


-- ── 2. Circle-applied counts: batched, and one DISTINCT fix for both ────────
-- "N in your circle applied" (design/handoff/README.md §2) counts PEOPLE. Both
-- functions here counted ROWS, which stopped being the same number in Phase
-- 4a: project-roles.sql §4 dropped applications' unique (project_id,
-- applicant_id) in favour of two partial unique indexes, so one applicant can
-- now hold several applications on one production — one per role. A connection
-- who applies for two roles was counted twice. count(distinct a.applicant_id)
-- is the fix, and it is applied to BOTH functions in this one file so the two
-- cannot disagree: the browse page (batched) and the detail page (singular)
-- must show the same number for the same project.
--
-- Both are security definer for the same reason: an inline join would see only
-- the caller's own rows on applications and connections ("Parties read own
-- connections") and always report 0. Both return bare counts, never WHO.

-- The singular version, superseding connections.sql §7 — same signature, same
-- join, DISTINCT applicants. connections.sql carries a pointer comment naming
-- this file as the single source of truth.
create or replace function public.circle_applied_count(p_project_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct a.applicant_id)
  from public.applications a
  join public.connections c
    on c.status = 'accepted'
   and ((c.requester_id = auth.uid() and c.addressee_id = a.applicant_id)
     or (c.addressee_id = auth.uid() and c.requester_id = a.applicant_id))
  where a.project_id = p_project_id;
$$;

grant execute on function public.circle_applied_count(uuid) to anon, authenticated;

-- The batched version. The browse screen renders a page of ten projects, and
-- ten RPC round trips per page load is the per-row-RPC pattern app/dashboard
-- already avoids — so this takes the whole page of ids at once. Same join as
-- the singular above, grouped by project.
--
-- A project with zero circle applications is simply ABSENT from the result set
-- (that is what the group-by yields) — the caller defaults a missing id to 0
-- rather than expecting one row per requested id.
create or replace function public.circle_applied_counts(p_project_ids uuid[])
returns table (project_id uuid, applied_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select a.project_id, count(distinct a.applicant_id)
  from public.applications a
  join public.connections c
    on c.status = 'accepted'
   and ((c.requester_id = auth.uid() and c.addressee_id = a.applicant_id)
     or (c.addressee_id = auth.uid() and c.requester_id = a.applicant_id))
  where a.project_id = any(p_project_ids)
  group by a.project_id;
$$;

grant execute on function public.circle_applied_counts(uuid[]) to anon, authenticated;
