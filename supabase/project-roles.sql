-- ============================================================================
-- Project roles, pay, type & tags (Callboard Phase 4a — schema only)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
-- Additive and forward-only, with ONE deliberate exception called out in §4:
-- the applications unique (project_id, applicant_id) constraint is REPLACED by
-- two partial unique indexes.
--
-- Run this ONCE in the Supabase SQL editor, AFTER marketplace.sql (projects,
-- applications, is_approved_pro, has_applied), admin.sql (is_admin),
-- multi-discipline.sql (projects.disciplines) and saved-items.sql.
--
-- What the Projects design (design/handoff/README.md §2) needs and this adds:
--   * category chips           → projects.project_type
--   * "$450–$900 / day"        → projects.pay_min / pay_max / pay_unit
--   * tag chips                → projects.tags
--   * "Posted Jul 29"          → projects.posted_at
--   * "★ STAFF PICK" ring      → projects.staff_pick (+ a guard trigger)
--   * "ROLES OPEN · 5" rail    → public.project_roles
--   * a per-role Apply pill    → applications.role_id
--   * the bookmark icon        → saved_items.item_type gains 'project'
--
-- As everywhere else in this app, elevated reads come from Row Level Security
-- via security-definer helpers, NOT from the service-role / secret key.
-- ============================================================================


-- ── 1. projects: type, pay, tags, posted_at, staff_pick ─────────────────────
-- All additive and all defaulted, so every existing row stays valid without a
-- backfill (except posted_at, handled below).
alter table public.projects
  add column if not exists project_type text not null default 'other',
  add column if not exists pay_min      integer,
  add column if not exists pay_max      integer,
  add column if not exists pay_unit     text default 'day',
  add column if not exists tags         text[] not null default '{}',
  add column if not exists staff_pick   boolean not null default false;

-- The seven category chips in the design, plus 'other' — which exists so the
-- default above is a no-op for every row that predates this file.
alter table public.projects
  drop constraint if exists projects_project_type_check;
alter table public.projects
  add constraint projects_project_type_check
  check (
    project_type in (
      'short_film','feature_film','web_series','music_video','commercial',
      'documentary','crew_call','other'
    )
  );

-- Both bounds are nullable: unpaid and deferred projects have neither. The
-- range check only applies when both are present.
alter table public.projects
  drop constraint if exists projects_pay_range_check;
alter table public.projects
  add constraint projects_pay_range_check
  check (pay_min is null or pay_max is null or pay_min <= pay_max);

alter table public.projects
  drop constraint if exists projects_pay_unit_check;
alter table public.projects
  add constraint projects_pay_unit_check
  check (pay_unit is null or pay_unit in ('hour','day','week','project'));

-- posted_at is the meta line's "Posted Jul 29". Added NULLABLE first so the
-- backfill can distinguish "never set" from "set to now()", then tightened —
-- adding it with `not null default now()` outright would stamp every historic
-- row with the migration's timestamp instead of its real creation time.
-- Re-running is a no-op: nothing is null the second time through.
alter table public.projects
  add column if not exists posted_at timestamptz;
update public.projects set posted_at = created_at where posted_at is null;
alter table public.projects alter column posted_at set default now();
alter table public.projects alter column posted_at set not null;

create index if not exists projects_project_type_idx on public.projects (project_type);
create index if not exists projects_posted_at_idx    on public.projects (posted_at desc);


-- ── 2. staff_pick guard ─────────────────────────────────────────────────────
-- "Owners update own projects" (marketplace.sql) lets an owner write ANY column
-- on their own row, and Postgres RLS has no column-level control — so without
-- this, every pro could hand themselves the design's "★ STAFF PICK" ring.
-- A BEFORE trigger is the only place the old value can be restored, since
-- WITH CHECK never sees OLD.
--
-- Two callers may set it:
--   * an admin, via is_admin() (admin.sql);
--   * a trusted backend context with NO end user attached — auth.uid() is null
--     there, which covers scripts/seed.ts (service role) and hand-run SQL.
-- The null-uid arm is not a hole: anon also has a null auth.uid(), but the
-- projects INSERT/UPDATE policies both require created_by = auth.uid(), so an
-- anon caller can never get a row as far as this trigger.
create or replace function public.projects_guard_staff_pick()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.staff_pick := false;
  else
    new.staff_pick := old.staff_pick;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_guard_staff_pick on public.projects;
create trigger projects_guard_staff_pick
  before insert or update on public.projects
  for each row execute function public.projects_guard_staff_pick();


-- ── 3. project_roles ────────────────────────────────────────────────────────
-- One row per open role on a production — the design's right-hand "ROLES OPEN"
-- rail. The qualifier line it renders ("Lead · Female · 22–30") is composed at
-- the UI layer from billing + gender + the age range; there is deliberately no
-- denormalised qualifier string to drift out of sync.
--
-- age_min / age_max are both nullable: a crew role has no age range at all.
create table if not exists public.project_roles (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null,
  billing     text not null default 'supporting'
    check (billing in ('lead','supporting','background','crew')),
  gender      text not null default 'any'
    check (gender in ('any','female','male','non-binary')),
  age_min     integer,
  age_max     integer,
  description text not null default '',
  status      text not null default 'open'
    check (status in ('open','filled')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  check (age_min is null or age_max is null or age_min <= age_max)
);

-- The rail reads one project's roles in display order.
create index if not exists project_roles_project_id_sort_order_idx
  on public.project_roles (project_id, sort_order);


-- ── 4. applications: role-level applications ────────────────────────────────
-- role_id is NULLABLE: existing rows are whole-project applications ("reach out
-- with your role and reel") and stay valid, which is also the shape the
-- Midnight-Diner-style crew calls keep using.
alter table public.applications
  add column if not exists role_id uuid references public.project_roles (id) on delete cascade;

-- A role_id, when present, must belong to the SAME project as project_id.
-- A CHECK constraint cannot contain a subquery, so this is a security-definer
-- helper called from a BEFORE trigger. security definer for the usual reason:
-- the applicant generally cannot SELECT the project_roles row of a project they
-- are not yet part of, and an inline check under their own RLS would report
-- "no such role" for a role that plainly exists.
create or replace function public.role_belongs_to_project(
  p_role_id uuid,
  p_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_roles r
    where r.id = p_role_id
      and r.project_id = p_project_id
  );
$$;

grant execute on function public.role_belongs_to_project(uuid, uuid) to anon, authenticated;

create or replace function public.applications_check_role_project()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role_id is not null
     and not public.role_belongs_to_project(new.role_id, new.project_id) then
    raise exception
      'applications: role_id % does not belong to project %',
      new.role_id, new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_check_role_project on public.applications;
create trigger applications_check_role_project
  before insert or update on public.applications
  for each row execute function public.applications_check_role_project();

-- THE ONE NON-ADDITIVE CHANGE IN THIS FILE.
-- marketplace.sql's `unique (project_id, applicant_id)` means one application
-- per person per production, which the design breaks: every role gets its own
-- Apply pill, so one person must be able to apply for two roles on one
-- production. Replaced by two PARTIAL unique indexes that keep the old
-- guarantee for whole-project applications and add the equivalent per-role one:
--   * at most one whole-project application per (project, applicant)
--   * at most one application per (role, applicant)
alter table public.applications
  drop constraint if exists applications_project_id_applicant_id_key;

create unique index if not exists applications_project_applicant_whole_uniq
  on public.applications (project_id, applicant_id)
  where role_id is null;

create unique index if not exists applications_role_applicant_uniq
  on public.applications (role_id, applicant_id)
  where role_id is not null;


-- ── 5. saved_items: projects are bookmarkable ───────────────────────────────
-- The design puts a bookmark icon on every project card and a "★ Saved (4)"
-- pill in the Projects header, so item_type gains 'project'. Nothing else about
-- saved_items changes here.
--
-- NOTE for Phase 4b: the "Users save published items" INSERT policy in
-- saved-items.sql branches on item_type with an arm for 'event' and one for
-- 'article' and no ELSE, so it will still REJECT a 'project' save. Widening
-- that constraint is necessary but not sufficient — the policy needs a third
-- arm (an EXISTS against public.projects) before the bookmark can be wired up.
alter table public.saved_items
  drop constraint if exists saved_items_item_type_check;
alter table public.saved_items
  add constraint saved_items_item_type_check
  check (item_type in ('event','article','project'));


-- ── 6. Security-definer helpers ─────────────────────────────────────────────

-- Can the current user see this project? Mirrors the projects SELECT policy
-- ("Approved members read open projects") exactly. Modelled on can_view_event()
-- (comments.sql), and it exists for the same reason: so project_roles' SELECT
-- policy states its rule once instead of re-deriving three-way visibility, and
-- so that read doesn't re-enter projects' own RLS from inside a policy.
create or replace function public.can_view_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        (p.status = 'open' and public.is_approved_pro())
        or p.created_by = auth.uid()
        or public.has_applied(p.id)
      )
  );
$$;

grant execute on function public.can_view_project(uuid) to anon, authenticated;

-- Has the current user applied for this ROLE? Same shape and same reason as
-- has_applied() (marketplace.sql): it reads applications without tripping that
-- table's RLS, so the per-role Apply pill can render its applied state.
create or replace function public.has_applied_to_role(p_role_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.applications a
    where a.role_id = p_role_id
      and a.applicant_id = auth.uid()
  );
$$;

grant execute on function public.has_applied_to_role(uuid) to anon, authenticated;

-- (No role-count helper on purpose: project_roles rows are visible to EXACTLY
-- the audience of their parent project, so a plain count(*) under RLS already
-- returns the right number for "ROLES OPEN · 5". circle_applied_count()
-- (connections.sql) is unchanged and still serves "N in your circle applied".)


-- ── 7. Row Level Security: project_roles ────────────────────────────────────
alter table public.project_roles enable row level security;

grant select, insert, update, delete on public.project_roles to authenticated;
grant select on public.project_roles to anon;

-- Read: exactly the projects you can read.
drop policy if exists "Read roles of visible projects" on public.project_roles;
create policy "Read roles of visible projects"
  on public.project_roles for select
  using (public.can_view_project(project_id));

-- Write: the project owner only. The inline projects lookup is safe here (no
-- security-definer helper needed) because it only ever asks about the CALLER's
-- OWN project, which the projects SELECT policy always exposes to them.
drop policy if exists "Owners create roles on own projects" on public.project_roles;
create policy "Owners create roles on own projects"
  on public.project_roles for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    )
  );

-- Both clauses, so a role can neither be edited by a non-owner nor moved onto
-- somebody else's project.
drop policy if exists "Owners update roles on own projects" on public.project_roles;
create policy "Owners update roles on own projects"
  on public.project_roles for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    )
  );

drop policy if exists "Owners delete roles on own projects" on public.project_roles;
create policy "Owners delete roles on own projects"
  on public.project_roles for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.created_by = auth.uid()
    )
  );
