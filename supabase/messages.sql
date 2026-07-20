-- ============================================================================
-- Direct messages (conversations + participants + messages)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
--
-- Run this ONCE in the Supabase SQL editor, AFTER social-feed.sql (it reuses
-- public.is_following() and public.is_approved_pro(), so those must exist).
--
-- Messages are PROFESSIONAL-ONLY and NEVER public: no anon grant anywhere.
--
-- THE SPAM MODEL LIVES IN THE INBOX, not the follow graph (which stays a
-- frictionless one-way follow — see docs/DECISIONS.md). Anyone may DM anyone; a
-- cold DM lands in the recipient's REQUESTS (their participant row starts
-- accepted = false). The recipient Accepts (flip their row to true) or Ignores
-- (DELETE their row). FREE PASS: if the recipient already FOLLOWS the sender,
-- their row starts accepted = true and the thread opens straight in Chats — the
-- follow graph IS the spam filter (public.is_following()).
--
-- As everywhere else, elevated access comes from RLS + security-definer helpers,
-- NOT the service-role / secret key. No code under app/ uses the secret key.
-- ============================================================================


-- ── 1. conversations ────────────────────────────────────────────────────────
-- One row per unordered PAIR of people. CANONICAL ORDERING IS LOAD-BEARING:
-- user_a is ALWAYS the lexicographically smaller uuid (check user_a < user_b),
-- so a pair maps to exactly ONE row and (A,B) / (B,A) can't both exist (unique).
-- EVERY caller MUST normalise the pair to (min, max) before insert OR lookup —
-- the app does this in openConversation() (app/messages/actions.ts). Get this
-- wrong and you'll silently create duplicate threads for the same two people.
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles (id) on delete cascade,
  user_b     uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a <> user_b),
  check (user_a < user_b),
  unique (user_a, user_b)
);


-- ── 2. conversation_participants ────────────────────────────────────────────
-- Two rows per conversation, one per side. `accepted` is PER PARTICIPANT: the
-- sender's row is true from the start; the recipient's is false (cold DM →
-- Requests) UNLESS they already follow the sender (free pass → true → Chats).
-- `last_read_at` (null = never read) drives the unread badge. "Ignore" DELETES
-- the recipient's own row here (see the messages insert policy for how that then
-- blocks the sender).
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id)      on delete cascade,
  accepted        boolean not null default false,
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);

create index if not exists conversation_participants_user_id_idx
  on public.conversation_participants (user_id);


-- ── 3. messages ─────────────────────────────────────────────────────────────
-- An immutable, append-only log (like activity_events): no edit, no delete. The
-- body must be non-blank. The (conversation_id, created_at) index serves the
-- thread view (ordered oldest→newest) and the "last message" lookups.
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id)      on delete cascade,
  body            text not null check (length(trim(body)) > 0),
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);


-- ── 4. Security-definer helper ──────────────────────────────────────────────
-- Is the current user a participant in conv_id? security definer so it can read
-- conversation_participants WITHOUT tripping that table's own RLS — the messages
-- SELECT policy calls this, which would otherwise recurse
-- (messages → participants → messages …). Modeled on is_following()
-- (social-feed.sql): sql + security definer + stable + pinned search_path.
create or replace function public.in_conversation(conv_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = conv_id
      and p.user_id = auth.uid()
  );
$$;


-- ── 5. Row Level Security ───────────────────────────────────────────────────
alter table public.conversations             enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;

-- Authenticated ONLY on every table — messages are never public, so anon gets
-- no grant and no policy anywhere.
grant select, insert on public.conversations to authenticated;
grant select, insert, update, delete on public.conversation_participants to authenticated;
grant select, insert on public.messages to authenticated;


-- conversations ──────────────────────────────────────────────────────────────
-- Read a conversation you're a party to.
drop policy if exists "Read own conversations" on public.conversations;
create policy "Read own conversations"
  on public.conversations for select
  to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

-- Start a conversation you're a party to (approved pros only).
drop policy if exists "Approved pros create own conversations" on public.conversations;
create policy "Approved pros create own conversations"
  on public.conversations for insert
  to authenticated
  with check (
    public.is_approved_pro()
    and (user_a = auth.uid() or user_b = auth.uid())
  );

-- (No UPDATE/DELETE: the pair row is immutable once created.)


-- conversation_participants ──────────────────────────────────────────────────
-- Read participant rows for a conversation you're in (in_conversation avoids
-- recursing this table's own RLS).
drop policy if exists "Read participants of own conversations" on public.conversation_participants;
create policy "Read participants of own conversations"
  on public.conversation_participants for select
  to authenticated
  using (public.in_conversation(conversation_id));

-- Insert participant rows for a conversation you're a party to. Deliberately
-- keyed off CONVERSATIONS membership (user_a/user_b), NOT in_conversation():
-- when a thread is first opened the caller inserts BOTH rows (their own AND the
-- other side's), and at that instant no participant row exists yet — using
-- in_conversation() here would deadlock the very first insert. Checking the
-- conversations pair lets a party seed both sides. (This is why the SELECT
-- policy uses in_conversation but this one does not.)
drop policy if exists "Party seeds participants" on public.conversation_participants;
create policy "Party seeds participants"
  on public.conversation_participants for insert
  to authenticated
  with check (
    public.is_approved_pro()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

-- Update ONLY your own row — this is how Accept (accepted = true) and
-- read-receipts (last_read_at) work. You can never flip the other side's state.
drop policy if exists "Update own participant row" on public.conversation_participants;
create policy "Update own participant row"
  on public.conversation_participants for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Delete ONLY your own row — this is "Ignore". Removing your row hides the
-- thread from you AND (see messages insert policy) blocks the sender from
-- adding more.
drop policy if exists "Delete own participant row" on public.conversation_participants;
create policy "Delete own participant row"
  on public.conversation_participants for delete
  to authenticated
  using (user_id = auth.uid());


-- messages ───────────────────────────────────────────────────────────────────
-- Read messages in a conversation you're in.
drop policy if exists "Read messages in own conversations" on public.messages;
create policy "Read messages in own conversations"
  on public.messages for select
  to authenticated
  using (public.in_conversation(conversation_id));

-- Send a message: as yourself, as an approved pro, into a conversation you're in
-- (your own participant row exists), AND ONLY IF THE OTHER PARTY STILL HAS A ROW.
-- That last EXISTS is the teeth of "Ignore": once the recipient deletes their
-- participant row, no row with user_id <> me remains, so this insert fails and
-- the sender can't pile on. Enforced HERE in the DB, never in app code.
--
-- The recipient check hangs off public.conversations (aliased c), deliberately.
-- `conversation_id` in `c.id = conversation_id` is the NEW message's column — and
-- it can only mean that because c (conversations) has no `conversation_id` column
-- to shadow it. (Writing `where p.conversation_id = conversation_id` inside a
-- subquery that selects `from conversation_participants p` would instead bind the
-- bare name to p.conversation_id — the condition becomes always-true and the
-- check silently spans the WHOLE table, so Ignore stops blocking anyone. Same
-- shadowing trap fixed in classes.sql.) The inner participant lookup correlates
-- to c.id, which is unambiguous. The caller can read both participant rows
-- because in_conversation(me) is true.
drop policy if exists "Send into own un-ignored conversations" on public.messages;
create policy "Send into own un-ignored conversations"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_approved_pro()
    and public.in_conversation(conversation_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and exists (
          select 1 from public.conversation_participants p
          where p.conversation_id = c.id
            and p.user_id <> auth.uid()
        )
    )
  );

-- (No UPDATE/DELETE: messages are an immutable log, like activity_events.)
