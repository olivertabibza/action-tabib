-- ============================================================================
-- Project Marketplace v1
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
--
-- Notes on naming, so this matches the rest of the app:
--   * "creator" in the spec  == account_type 'professional' in this codebase
--   * "fan" in the spec       == account_type 'consumer'
--   * The approval flag already exists as profiles.application_status
--     (set to 'pending' at onboarding). We reuse it with values
--     'pending' | 'approved' instead of adding a second 'status' column.
-- ============================================================================


-- ── 1. Profiles: make sure the columns the marketplace relies on exist ──────
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists role text,
  add column if not exists application_status text default 'pending';


-- ── 2. projects ─────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  -- FK to profiles (not auth.users) so Supabase can embed the poster's
  -- display_name + role in a single query. profiles.id == the auth user id.
  created_by   uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  discipline   text not null default 'any'
    check (discipline in ('actor','writer','director','producer',
                          'cinematographer','editor','composer','any')),
  description  text not null default '',
  location     text not null default '',
  compensation text not null default 'unpaid'
    check (compensation in ('paid','unpaid','deferred')),
  status       text not null default 'open'
    check (status in ('open','closed')),
  created_at   timestamptz not null default now()
);

create index if not exists projects_created_by_idx on public.projects (created_by);
create index if not exists projects_status_idx on public.projects (status);


-- ── 3. applications ─────────────────────────────────────────────────────────
create table if not exists public.applications (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  note         text not null default '',
  status       text not null default 'submitted',
  created_at   timestamptz not null default now(),
  -- No one applies to the same project twice.
  unique (project_id, applicant_id)
);

create index if not exists applications_project_id_idx on public.applications (project_id);
create index if not exists applications_applicant_id_idx on public.applications (applicant_id);


-- ── 4. Row Level Security ───────────────────────────────────────────────────
alter table public.projects     enable row level security;
alter table public.applications enable row level security;

-- Helper: is the current user an approved industry professional?
create or replace function public.is_approved_pro()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.account_type = 'professional'
      and p.application_status = 'approved'
  );
$$;

-- Helper: has the current user applied to this project? security definer so it
-- can read applications without tripping that table's own RLS (which would
-- otherwise recurse: projects policy → applications → projects policy …).
create or replace function public.has_applied(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.applications a
    where a.project_id = p_project_id
      and a.applicant_id = auth.uid()
  );
$$;

-- profiles: approved members may read other members' profiles. This is what
-- lets the cards/applicant lists show display_name + role. (The existing
-- "read your own profile" policy stays in place; policies are OR'd together.)
drop policy if exists "Approved members can view profiles" on public.profiles;
create policy "Approved members can view profiles"
  on public.profiles for select
  using (public.is_approved_pro());

-- projects: approved members read OPEN projects; owners always read their own.
drop policy if exists "Approved members read open projects" on public.projects;
create policy "Approved members read open projects"
  on public.projects for select
  using (
    (status = 'open' and public.is_approved_pro())
    or created_by = auth.uid()
    or public.has_applied(id)
  );

-- projects: an approved member can create a project they own.
drop policy if exists "Approved members create own projects" on public.projects;
create policy "Approved members create own projects"
  on public.projects for insert
  with check (created_by = auth.uid() and public.is_approved_pro());

-- projects: only the owner can edit / close their project.
drop policy if exists "Owners update own projects" on public.projects;
create policy "Owners update own projects"
  on public.projects for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- applications: an approved member can apply (to an open project they don't own).
drop policy if exists "Approved members create applications" on public.applications;
create policy "Approved members create applications"
  on public.applications for insert
  with check (
    applicant_id = auth.uid()
    and public.is_approved_pro()
    and exists (
      select 1 from public.projects pr
      where pr.id = project_id
        and pr.status = 'open'
        and pr.created_by <> auth.uid()
    )
  );

-- applications: applicant reads their own; project owner reads applications to
-- their projects.
drop policy if exists "Read own or owned applications" on public.applications;
create policy "Read own or owned applications"
  on public.applications for select
  using (
    applicant_id = auth.uid()
    or exists (
      select 1 from public.projects pr
      where pr.id = project_id
        and pr.created_by = auth.uid()
    )
  );
