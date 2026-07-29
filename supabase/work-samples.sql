-- ============================================================================
-- Work samples v1
-- ----------------------------------------------------------------------------
-- Short video clips (shorts, reels, scenes) that approved professionals show
-- on their profile. Safe to run more than once (IF NOT EXISTS /
-- drop-then-create throughout). Additive only — touches nothing shipped.
--
-- Unlike "portfolios" (private + signed URLs), this bucket is PUBLIC-READ:
-- work samples are meant to be seen, and signed URLs expire mid-playback and
-- defeat caching for <video> tags. Writes are still locked down by the
-- storage policies below; who sees the *listing* is governed by RLS on
-- public.work_samples (signed-in users only).
-- ============================================================================


-- ── 1. Bucket ───────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('work_samples', 'work_samples', true)
on conflict (id) do nothing;


-- ── 2. Storage policies ─────────────────────────────────────────────────────
-- Uploads: only approved pros, and only into their own folder
-- (paths are `<user id>/<uuid>-<filename>`).
drop policy if exists "Approved pros upload own work samples" on storage.objects;
create policy "Approved pros upload own work samples"
  on storage.objects for insert
  with check (
    bucket_id = 'work_samples'
    and public.is_approved_pro()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Deletes: owner only, same folder check.
drop policy if exists "Owners delete own work samples" on storage.objects;
create policy "Owners delete own work samples"
  on storage.objects for delete
  using (
    bucket_id = 'work_samples'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No UPDATE policy: replacing a clip = delete + re-upload.
-- No SELECT policy: the bucket is public, so playback bypasses RLS.


-- ── 3. work_samples table ───────────────────────────────────────────────────
create table if not exists public.work_samples (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  title        text not null default '',
  storage_path text not null,
  created_at   timestamptz not null default now()
);

create index if not exists work_samples_profile_id_idx
  on public.work_samples (profile_id);


-- ── 4. Row Level Security ───────────────────────────────────────────────────
alter table public.work_samples enable row level security;

-- Any signed-in user can browse samples — fans view pro profiles too.
drop policy if exists "Signed-in users read work samples" on public.work_samples;
create policy "Signed-in users read work samples"
  on public.work_samples for select
  using (auth.uid() is not null);

-- Only an approved pro can add samples, and only to their own profile.
drop policy if exists "Approved pros add own work samples" on public.work_samples;
create policy "Approved pros add own work samples"
  on public.work_samples for insert
  with check (profile_id = auth.uid() and public.is_approved_pro());

-- Owner only. No UPDATE policy — replace = delete + re-add.
drop policy if exists "Owners delete own work sample rows" on public.work_samples;
create policy "Owners delete own work sample rows"
  on public.work_samples for delete
  using (profile_id = auth.uid());
