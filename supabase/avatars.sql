-- ============================================================================
-- Profile photos (audit UX B-01, the in-house Blocker)
-- ----------------------------------------------------------------------------
-- Safe to run more than once (IF NOT EXISTS / drop-then-create throughout).
-- Additive only. Run on the TEST project first, then `npm test`, then
-- production. Run supabase/public-profiles.sql right after this file: the
-- public_profiles view reads the new column.
--
-- One photo per person, pros and fans alike, in a PUBLIC-READ bucket like
-- "work_samples": photos are meant to be seen by anyone who can see the person,
-- and signed URLs would expire and defeat caching on every list. Writes are
-- locked to the owner's own folder.
--
-- Files are named `<user id>/<random uuid>.<ext>`: every upload gets a new
-- name, so a cached old photo never shows under the new one (ENG F12), and the
-- app deletes the previous file when the path changes (ENG F13).
-- ============================================================================


-- ── 1. Column ───────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists avatar_path text;

-- The path must sit in the owner's own folder, so nobody can point their
-- profile at someone else's photo.
alter table public.profiles drop constraint if exists profiles_avatar_path_own_folder;
alter table public.profiles add constraint profiles_avatar_path_own_folder
  check (
    avatar_path is null
    or (avatar_path like id::text || '/%' and length(avatar_path) <= 200)
  );

-- Every readable profile column needs an explicit grant (profile-privacy.sql
-- §2, where avatar_path is also listed so a re-run of that file keeps it).
grant select (avatar_path) on public.profiles to anon, authenticated;


-- ── 2. Bucket ───────────────────────────────────────────────────────────────
-- 2 MB, still images only. The app checks both before uploading; the bucket
-- enforces them too.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ── 3. Storage policies ─────────────────────────────────────────────────────
-- Any signed-in member (pro, pending pro or fan) uploads only into their own
-- folder.
drop policy if exists "Members upload own avatar" on storage.objects;
create policy "Members upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner reads their own folder. Not for showing photos (the bucket is public)
-- but because Storage only deletes rows the caller can also SELECT: without
-- this, removing an old photo silently deleted nothing.
drop policy if exists "Members read own avatar" on storage.objects;
create policy "Members read own avatar"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner deletes their own old photos.
drop policy if exists "Members delete own avatar" on storage.objects;
create policy "Members delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No UPDATE policy: a new photo is a new file (see the header).
