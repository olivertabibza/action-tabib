-- ============================================================================
-- Admin dashboard
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
--
-- An admin's elevated rights come from Row Level Security via the is_admin()
-- helper below — NOT from the service-role / secret key. No code under app/
-- ever uses the secret key.
--
-- ── BOOTSTRAP ───────────────────────────────────────────────────────────────
-- The first admin has to be made by hand. After running this whole file once,
-- run this ONE command once to make yourself an admin:
--
--   update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'tabiboliver@gmail.com');
--
-- ============================================================================


-- ── 1. Profiles: the admin flag ─────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_admin boolean not null default false;


-- ── 2. Helper: is the current user an admin? ────────────────────────────────
-- Same shape as public.is_approved_pro(): security definer so it can read the
-- caller's profile row without tripping that table's own RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  );
$$;


-- ── 3. RLS: admins read every profile, and decide applications ──────────────
-- These are OR'd with the existing "own profile" / "approved members" policies.

-- Read every profile, so the applications queue can be listed.
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Update any profile. The admin server actions only ever write
-- application_status; Postgres RLS can't restrict which columns are written, so
-- that limit lives in the server action, not in this policy.
drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());


-- ── 4. RLS: admins read every project, and moderate listings ────────────────

-- Read every project (open or closed, any owner) for the moderation list.
drop policy if exists "Admins can view all projects" on public.projects;
create policy "Admins can view all projects"
  on public.projects for select
  using (public.is_admin());

-- Update any project's status (to close a listing). No DELETE policy is granted
-- to admins anywhere, so admins cannot delete projects.
drop policy if exists "Admins can update projects" on public.projects;
create policy "Admins can update projects"
  on public.projects for update
  using (public.is_admin())
  with check (public.is_admin());


-- ── 5. Storage: admins can read applicants' portfolio files ─────────────────
-- Portfolio files live in the PRIVATE "portfolios" bucket under <user_id>/...
-- The page mints signed URLs with the anon key, which respects Storage RLS, so
-- an admin needs explicit read access to other users' objects.
drop policy if exists "Admins can read portfolio files" on storage.objects;
create policy "Admins can read portfolio files"
  on storage.objects for select
  using (bucket_id = 'portfolios' and public.is_admin());
