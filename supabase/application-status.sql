-- ============================================================================
-- Application status: project owners shortlist or decline applicants
-- ----------------------------------------------------------------------------
-- Safe to run more than once (drop-then-create; revoke and grant are
-- idempotent). Run AFTER marketplace.sql (applications, projects) and
-- project-roles.sql (applications.role_id).
--
-- Until now nobody could update applications (no UPDATE policy), so every row
-- stayed 'submitted', while the baseline left anon and authenticated with
-- GRANT ALL on the table. After this file:
--   * a project's owner may set status on applications to their own projects,
--     to 'submitted', 'shortlisted' or 'declined' only;
--   * nobody else may update an application, the applicant included;
--   * status is the ONLY column anyone can update (column grant);
--   * applicants can't choose a status when applying: INSERT is limited to the
--     columns applyToProject sends, so status always starts at its default,
--     'submitted'. Without this an applicant could insert themselves straight
--     onto the shortlist.
-- ============================================================================


-- ── 1. Column privileges ────────────────────────────────────────────────────
revoke update on public.applications from anon, authenticated;
grant update (status) on public.applications to authenticated;

revoke insert on public.applications from anon, authenticated;
grant insert (project_id, applicant_id, role_id, note)
  on public.applications to authenticated;


-- ── 2. Row policy: the project's owner sets status ──────────────────────────
-- The inline projects lookup only ever asks about the CALLER's OWN project,
-- which the projects SELECT policy always exposes to them (same reasoning as
-- the project_roles write policies in project-roles.sql).
drop policy if exists "Owners set status on applications to own projects"
  on public.applications;
create policy "Owners set status on applications to own projects"
  on public.applications for update
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    )
  )
  with check (
    status in ('submitted', 'shortlisted', 'declined')
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    )
  );
