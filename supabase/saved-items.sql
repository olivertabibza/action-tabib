-- ============================================================================
-- Saved items (bookmarks)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
--
-- Run this ONCE in the Supabase SQL editor, AFTER content.sql (it references
-- public.events and public.articles).
--
-- One row per (user, item): a member bookmarks an event or an article to find
-- again later. Any AUTHENTICATED user may save — fans and pros alike — but only
-- a PUBLISHED item, and only as themselves. Saves are PRIVATE: the table only
-- ever exposes the caller's OWN rows, so there is no public count view (unlike
-- event_rsvps) — nobody needs a "N people saved this" number.
--
-- As everywhere else in this app, the elevated read comes from Row Level
-- Security under the caller, NOT from the service-role / secret key. No code
-- under app/ uses the secret key.
-- ============================================================================


-- ── 1. saved_items ──────────────────────────────────────────────────────────
-- user_id FKs to profiles (profiles.id == the auth user id). item_id is
-- POLYMORPHIC — it points at public.events when item_type='event' or
-- public.articles when item_type='article' — so it deliberately has NO foreign
-- key. The UNIQUE (user_id, item_type, item_id) makes a save idempotent (you
-- can't save the same item twice) and lets the toggle collapse a double-insert
-- race. item_type is CHECK-constrained to the two saveable kinds today, with
-- room to add more later.
create table if not exists public.saved_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  item_type  text not null check (item_type in ('event','article')),
  item_id    uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

-- The profile list reads a user's saves newest-first.
create index if not exists saved_items_user_id_created_at_idx
  on public.saved_items (user_id, created_at desc);


-- ── 2. Row Level Security ───────────────────────────────────────────────────
alter table public.saved_items enable row level security;

-- Only authenticated users touch this table. Anon gets NO grant and no policy,
-- so it can never read the rows — saves are private to each user.
grant select, insert, delete on public.saved_items to authenticated;

-- Read your own saves (to render "Saved" state and the profile list).
drop policy if exists "Users read own saves" on public.saved_items;
create policy "Users read own saves"
  on public.saved_items for select
  to authenticated
  using (user_id = auth.uid());

-- Save as yourself, and only a published item. The published check branches on
-- item_type: an EXISTS against events for 'event', or against articles for
-- 'article'. Each EXISTS runs under the caller's RLS on those tables, where
-- published rows are readable, so this holds for any authenticated user — no
-- service-role needed.
--
-- (Superseded by projects-saved.sql — the single source of truth. Phase 4b
-- added a third arm for item_type='project', gated on can_view_project(); the
-- version below has only the 'event' and 'article' arms and would REJECT a
-- project save. Redefining it here as well would let the two files diverge on
-- the live DB, so change the policy THERE, not here.)
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
    )
  );

-- Unsave your own.
drop policy if exists "Users delete own saves" on public.saved_items;
create policy "Users delete own saves"
  on public.saved_items for delete
  to authenticated
  using (user_id = auth.uid());

-- (No UPDATE policy: a save is either present or not.)
