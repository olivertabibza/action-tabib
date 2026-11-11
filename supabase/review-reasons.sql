-- ============================================================================
-- Review reasons: an admin's note on an approval or rejection
-- ----------------------------------------------------------------------------
-- Safe to run more than once (IF NOT EXISTS / drop-then-create / create or
-- replace; revoke and grant are idempotent). Run AFTER admin.sql (is_admin),
-- content.sql + classes.sql (events, articles, classes) and marketplace.sql
-- (profiles).
--
-- When an admin rejects (or approves) a pro application, class, event or
-- article, they may add a short reason. The reason is about one person: the
-- applicant, or the content's author. ONLY that person and admins may read it,
-- never other members, and only admins may write it. It lives in its own table
-- rather than a profiles column, because profiles rows are readable by every
-- approved pro (profile-privacy.sql).
--
-- One row per reviewed item: the latest decision's reason. The admin actions
-- replace it on every decision that carries a reason and delete it on one that
-- doesn't, so a stale reason never outlives its decision.
-- ============================================================================


-- ── 1. Table ────────────────────────────────────────────────────────────────
create table if not exists public.review_reasons (
  item_type  text not null
    check (item_type in ('profile', 'class', 'event', 'article')),
  item_id    uuid not null,
  -- Who the reason is about. Always derived from the item by the trigger in
  -- §2, never taken from the caller, so the read rule can't be pointed at the
  -- wrong person.
  subject_id uuid not null references public.profiles (id) on delete cascade,
  reason     text not null
    check (char_length(btrim(reason)) between 1 and 500),
  decided_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (item_type, item_id)
);

create index if not exists review_reasons_subject_id_idx
  on public.review_reasons (subject_id);


-- ── 2. subject_id and decided_by come from the database ─────────────────────
-- security definer so it can look up an item's author whatever its status
-- (the admin can read them all anyway; this keeps the rule in one place).
create or replace function public.review_reasons_set_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.subject_id := case new.item_type
    when 'profile' then (select p.id from public.profiles p where p.id = new.item_id)
    when 'class'   then (select c.created_by from public.classes c where c.id = new.item_id)
    when 'event'   then (select e.created_by from public.events e where e.id = new.item_id)
    when 'article' then (select a.created_by from public.articles a where a.id = new.item_id)
  end;
  if new.subject_id is null then
    raise exception 'review_reasons: no % with id %', new.item_type, new.item_id;
  end if;
  new.decided_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists review_reasons_set_subject on public.review_reasons;
create trigger review_reasons_set_subject
  before insert or update on public.review_reasons
  for each row execute function public.review_reasons_set_subject();


-- ── 3. Privileges and row policies ──────────────────────────────────────────
alter table public.review_reasons enable row level security;

revoke all on public.review_reasons from anon, authenticated;
grant select, insert, update, delete on public.review_reasons to authenticated;

drop policy if exists "Subjects and admins read review reasons" on public.review_reasons;
create policy "Subjects and admins read review reasons"
  on public.review_reasons for select
  to authenticated
  using (subject_id = auth.uid() or public.is_admin());

drop policy if exists "Admins insert review reasons" on public.review_reasons;
create policy "Admins insert review reasons"
  on public.review_reasons for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins update review reasons" on public.review_reasons;
create policy "Admins update review reasons"
  on public.review_reasons for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins delete review reasons" on public.review_reasons;
create policy "Admins delete review reasons"
  on public.review_reasons for delete
  to authenticated
  using (public.is_admin());
