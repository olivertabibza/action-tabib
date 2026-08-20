-- ============================================================================
-- Owners delete their own projects (Callboard Phase 4b)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (drop-then-create). Additive and forward-only:
-- it adds ONE policy and ONE grant, and changes no table, column, constraint
-- or existing policy.
--
-- Run this ONCE in the Supabase SQL editor, AFTER marketplace.sql (which
-- creates public.projects and its select / insert / update policies).
--
-- WHY: marketplace.sql gave projects SELECT, INSERT and UPDATE policies and no
-- DELETE policy, so a project row could be closed but never removed. Under RLS
-- a DELETE with no permissive policy is not an error — it matches no rows and
-- reports success — which is how tests/rls/project-roles.test.ts's "[TEST]
-- Circle Count Fixture" project leaked into the live browse screen: its
-- teardown issued the delete, the delete silently did nothing, and the row
-- stayed open and visible to every approved pro.
--
-- BLAST RADIUS — read before running. Both child FKs are ON DELETE CASCADE:
--   * public.applications.project_id  (marketplace.sql)
--   * public.project_roles.project_id (project-roles.sql)
-- so deleting a project also destroys every application anyone made to it and
-- every role on it. That is the intended marketplace behaviour (a listing and
-- its applications go together), but it is destructive and irreversible, and
-- it is the reason this is owner-only with no admin arm: an owner removing
-- their own posting is a normal action; anyone removing someone else's is not.
-- Nothing in app/ calls this today — closing a project (status = 'closed')
-- remains the soft, non-destructive path the UI offers.
--
-- As everywhere else in this app, the boundary is Row Level Security under the
-- caller, NOT the service-role / secret key.
-- ============================================================================

grant delete on public.projects to authenticated;

-- Mirrors "Owners update own projects" (marketplace.sql) exactly: created_by
-- is the whole rule, and it needs no security-definer helper because it asks
-- only about the CALLER's own row, which the projects SELECT policy always
-- exposes to them.
drop policy if exists "Owners delete own projects" on public.projects;
create policy "Owners delete own projects"
  on public.projects for delete
  to authenticated
  using (created_by = auth.uid());
