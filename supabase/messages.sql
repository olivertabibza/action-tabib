-- ============================================================================
-- Direct messages (conversations + participants + messages)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (everything uses IF NOT EXISTS / drop-then-create).
--
-- Run this in the Supabase SQL editor, AFTER social-feed.sql and connections.sql
-- (it reuses public.is_approved_pro() and public.profile_is_approved_pro(), so
-- those must exist).
--
-- Messages are PROFESSIONAL-ONLY and NEVER public: no anon grant anywhere.
--
-- THE SPAM MODEL LIVES IN THE INBOX, not the follow graph (which stays a
-- frictionless one-way follow — see docs/DECISIONS.md). Anyone may DM anyone; a
-- cold DM lands in the recipient's REQUESTS (their participant row starts
-- accepted = false). The recipient Accepts (flip their row to true) or Ignores
-- (DELETE their row). FREE PASS: if the recipient already FOLLOWS the sender,
-- their row starts accepted = true and the thread opens straight in Chats — the
-- follow graph IS the spam filter.
--
-- THREADS ARE CREATED BY ONE FUNCTION. Clients can't insert conversations or
-- participant rows at all; public.open_conversation() (§6) does both, atomically,
-- and computes the recipient's `accepted` itself. Clients can update only
-- `accepted` and `last_read_at` on their own participant row (audit ENG F03/F07).
--
-- As everywhere else, elevated access comes from RLS + security-definer helpers,
-- NOT the service-role / secret key. No code under app/ uses the secret key.
-- ============================================================================


-- ── 1. conversations ────────────────────────────────────────────────────────
-- One row per unordered PAIR of people. CANONICAL ORDERING IS LOAD-BEARING:
-- user_a is ALWAYS the lexicographically smaller uuid (check user_a < user_b),
-- so a pair maps to exactly ONE row and (A,B) / (B,A) can't both exist (unique).
-- EVERY caller MUST normalise the pair to (min, max) before insert OR lookup —
-- open_conversation() (§6) does this with least()/greatest(), and it is the only
-- thing that inserts here.
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
-- Two rows per conversation, one per side, both inserted by open_conversation()
-- (§6). `accepted` is PER PARTICIPANT: the sender's row is true from the start;
-- the recipient's is false (cold DM → Requests) UNLESS they already follow the
-- sender (free pass → true → Chats).
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
--
-- NO client INSERT on conversations or conversation_participants: only
-- open_conversation() (§6) creates them. The revokes are explicit because
-- Supabase's default privileges grant everything to anon/authenticated on new
-- tables. UPDATE on participants is column-level: Accept (accepted) and
-- read-receipts (last_read_at) only — never conversation_id or user_id, so a row
-- can't be moved into another thread or handed to someone else.
revoke insert on public.conversations             from anon, authenticated;
revoke insert, update on public.conversation_participants from anon, authenticated;
grant select on public.conversations to authenticated;
grant select, delete on public.conversation_participants to authenticated;
grant update (accepted, last_read_at) on public.conversation_participants to authenticated;
grant select, insert on public.messages to authenticated;


-- conversations ──────────────────────────────────────────────────────────────
-- Read a conversation you're a party to.
drop policy if exists "Read own conversations" on public.conversations;
create policy "Read own conversations"
  on public.conversations for select
  to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

-- (No INSERT policy: open_conversation() creates conversations. No
-- UPDATE/DELETE: the pair row is immutable once created.)
drop policy if exists "Approved pros create own conversations" on public.conversations;


-- conversation_participants ──────────────────────────────────────────────────
-- Read participant rows for a conversation you're in (in_conversation avoids
-- recursing this table's own RLS).
drop policy if exists "Read participants of own conversations" on public.conversation_participants;
create policy "Read participants of own conversations"
  on public.conversation_participants for select
  to authenticated
  using (public.in_conversation(conversation_id));

-- (No INSERT policy: open_conversation() seeds participant rows. A client
-- insert policy let a party add a third person, insert the recipient's row
-- already accepted, or re-create a row the recipient had deleted with Ignore.)
drop policy if exists "Party seeds participants" on public.conversation_participants;

-- Update ONLY your own row — this is how Accept (accepted = true) and
-- read-receipts (last_read_at) work. You can never flip the other side's state,
-- and the column grant in §5 limits it to those two columns.
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


-- ── 6. open_conversation(): the only way a thread is created ────────────────
-- Open (or start) the thread between the caller and p_other; returns its id.
-- Runs as the function owner so it can insert both tables (clients can't) and
-- read the other person's follows. One function call = one transaction, so a
-- thread is never half-created, and two people opening at once both land on the
-- same row (the unique pair + ON CONFLICT DO NOTHING; the loser re-selects it).
--
-- Participant seeding has two cases, and the split is what makes Ignore stick:
--   - NEW conversation: insert BOTH rows in one statement. Mine = accepted.
--     Theirs = accepted ONLY if they already follow me (follower_id = them,
--     following_id = me) — the free pass; otherwise the DM lands in Requests.
--   - EXISTING conversation: upsert only MY OWN row (accepted = true). The other
--     side's row is never created or changed — so a recipient re-opening a
--     thread they'd ignored re-creates THEIR row (history intact), but an
--     ignored SENDER re-opening can NOT resurrect the recipient's deleted row.
create or replace function public.open_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := auth.uid();
  v_conv uuid;
begin
  if not public.is_approved_pro() then
    raise exception 'Only approved professionals can message.';
  end if;
  if p_other is null then
    raise exception 'Choose someone to message.';
  end if;
  if p_other = v_me then
    raise exception 'You can''t message yourself.';
  end if;
  if not public.profile_is_approved_pro(p_other) then
    raise exception 'You can only message approved professionals.';
  end if;

  insert into public.conversations (user_a, user_b)
  values (least(v_me, p_other), greatest(v_me, p_other))
  on conflict (user_a, user_b) do nothing
  returning id into v_conv;

  if v_conv is not null then
    insert into public.conversation_participants (conversation_id, user_id, accepted)
    values
      (v_conv, v_me, true),
      (v_conv, p_other, exists (
        select 1 from public.follows f
        where f.follower_id = p_other
          and f.following_id = v_me
      ));
  else
    select c.id into v_conv
    from public.conversations c
    where c.user_a = least(v_me, p_other)
      and c.user_b = greatest(v_me, p_other);

    insert into public.conversation_participants (conversation_id, user_id, accepted)
    values (v_conv, v_me, true)
    on conflict (conversation_id, user_id) do update set accepted = true;
  end if;

  return v_conv;
end;
$$;

revoke execute on function public.open_conversation(uuid) from public, anon;
grant execute on function public.open_conversation(uuid) to authenticated;


-- ── 7. reset_seed_conversation(): TEST-ONLY ─────────────────────────────────
-- Used by tests/rls/messages.test.ts to start each run from a fresh thread,
-- since clients can no longer insert or reset participant rows themselves.
-- TEMPORARY: goes away with the separate test database (roadmap Step 2e).
--
-- Why it's safe on the shared database: it deletes ONLY the one conversation
-- between the caller and p_other (participants and messages cascade), and ONLY
-- when BOTH people's login emails (auth.users, which users can't edit through
-- the API) end in '@actionseed.test' — i.e. both are seed accounts. For anyone
-- else it does nothing. It can't be called with the anon key.
create or replace function public.reset_seed_conversation(p_other uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from auth.users u
    where u.id in (auth.uid(), p_other)
      and u.email like '%@actionseed.test'
  ) = 2 then
    delete from public.conversations c
    where c.user_a = least(auth.uid(), p_other)
      and c.user_b = greatest(auth.uid(), p_other);
  end if;
end;
$$;

revoke execute on function public.reset_seed_conversation(uuid) from public, anon;
grant execute on function public.reset_seed_conversation(uuid) to authenticated;
