-- ============================================================================
-- Profile privacy (audit ENG F04)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (drop-then-create / create or replace; revoke and
-- grant are idempotent).
--
-- Run this in the Supabase SQL editor, AFTER marketplace.sql (is_approved_pro,
-- projects, applications) and admin.sql (is_admin).
--
-- Why: "Approved members can view profiles" let any approved pro read every
-- profile row and every column — other people's email included, and pending
-- or rejected applicants' rows. RLS filters ROWS, never COLUMNS, so:
--   * rows: an approved pro now sees only approved pros' and fans' rows;
--   * columns: profiles.email has no SELECT grant for anon or authenticated,
--     so nobody reads it through the table, not even their own;
--   * a project owner reads their applicants' emails, and an admin reads any
--     profile's, through the two security-definer functions below. Both return
--     auth.users.email — the login email, which users can't edit through the
--     API — not profiles.email.
-- ============================================================================


-- ── 1. Row policies ─────────────────────────────────────────────────────────
-- The self-read policy has lived only in the dashboard until now; this is it
-- exactly as it is live, so it is tracked in the repo.
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Moved here from marketplace.sql. Approved pros see approved pros and fans;
-- pending and rejected applicants are visible only to themselves and admins
-- ("Admins can view all profiles", admin.sql).
drop policy if exists "Approved members can view profiles" on public.profiles;
create policy "Approved members can view profiles"
  on public.profiles for select
  using (
    public.is_approved_pro()
    and (
      account_type = 'consumer'
      or (account_type = 'professional' and application_status = 'approved')
    )
  );


-- ── 2. Column privileges: every column except email ─────────────────────────
-- ANY NEW PROFILE COLUMN MUST BE ADDED TO THIS GRANT, or the app can't read it.
revoke select on public.profiles from anon, authenticated;
grant select (
  id,
  account_type,
  application_status,
  created_at,
  role,
  consumer_type,
  portfolio_files,
  display_name,
  headline,
  bio,
  is_admin,
  skills
) on public.profiles to anon, authenticated;


-- ── 3. Owner: applicants' emails for one project ────────────────────────────
-- One row per applicant (an applicant can apply for several roles), and only
-- when the caller created the project; otherwise no rows.
create or replace function public.project_applicant_emails(p_project_id uuid)
returns table (applicant_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct a.applicant_id, u.email::text
  from public.applications a
  join public.projects p on p.id = a.project_id
  join auth.users u on u.id = a.applicant_id
  where a.project_id = p_project_id
    and p.created_by = auth.uid();
$$;

revoke execute on function public.project_applicant_emails(uuid) from public, anon;
grant execute on function public.project_applicant_emails(uuid) to authenticated;


-- ── 4. Admin: emails for a list of profiles ─────────────────────────────────
create or replace function public.admin_profile_emails(p_ids uuid[])
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text
  from auth.users u
  where u.id = any (p_ids)
    and public.is_admin();
$$;

revoke execute on function public.admin_profile_emails(uuid[]) from public, anon;
grant execute on function public.admin_profile_emails(uuid[]) to authenticated;
