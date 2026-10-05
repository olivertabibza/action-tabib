-- ============================================================================
-- Platform settings: auto-approve switches (Phase 1b)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (if not exists / drop-then-create / on conflict).
--
-- Run this in the Supabase SQL editor AFTER admin.sql (is_admin) and BEFORE
-- status-guards.sql, whose guard triggers call auto_approve_enabled().
--
-- One row, four switches — one per thing with a review step: pro
-- applications, classes, events and articles. When a switch is on, the guard
-- triggers in status-guards.sql let a new row of that kind skip review. This
-- file does NOT touch those triggers: keeping them defined in one file means
-- re-running status-guards.sql can never silently drop auto-approve.
-- Projects and class enrollments have no review step, so they have no switch.
-- ============================================================================


-- ── 1. The singleton table ──────────────────────────────────────────────────
-- id is a boolean pinned to true, so the table can never hold a second row.
create table if not exists public.platform_settings (
  id boolean primary key default true,
  auto_approve_pro_applications boolean not null default false,
  auto_approve_classes boolean not null default false,
  auto_approve_events boolean not null default false,
  auto_approve_articles boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint platform_settings_singleton check (id)
);

insert into public.platform_settings (id) values (true)
on conflict (id) do nothing;


-- ── 2. RLS: admins read and update; nobody inserts or deletes ───────────────
alter table public.platform_settings enable row level security;

drop policy if exists "Admins read platform settings" on public.platform_settings;
create policy "Admins read platform settings"
  on public.platform_settings for select
  using (public.is_admin());

drop policy if exists "Admins update platform settings" on public.platform_settings;
create policy "Admins update platform settings"
  on public.platform_settings for update
  using (public.is_admin())
  with check (public.is_admin());


-- ── 3. Stamp who changed it and when ────────────────────────────────────────
create or replace function public.platform_settings_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists platform_settings_stamp on public.platform_settings;
create trigger platform_settings_stamp
  before update on public.platform_settings
  for each row execute function public.platform_settings_stamp();


-- ── 4. Helper: is auto-approve on for this kind? ────────────────────────────
-- Security definer so the guard triggers can read the settings as any caller,
-- even though only admins can SELECT the table. kind is 'pro_applications' or a
-- content table name ('classes', 'events', 'articles'); anything else is false.
-- Signed-in users must be able to EXECUTE it, because the guard triggers run as
-- the inserting user; anon never inserts into those tables, so it gets nothing.
create or replace function public.auto_approve_enabled(kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case kind
      when 'pro_applications' then s.auto_approve_pro_applications
      when 'classes' then s.auto_approve_classes
      when 'events' then s.auto_approve_events
      when 'articles' then s.auto_approve_articles
      else false
    end
    from public.platform_settings s
    where s.id
  ), false);
$$;

revoke execute on function public.auto_approve_enabled(text) from public, anon;
grant execute on function public.auto_approve_enabled(text) to authenticated, service_role;
