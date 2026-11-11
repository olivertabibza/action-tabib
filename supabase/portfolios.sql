-- ============================================================================
-- Portfolio files: who can read and write the private "portfolios" bucket
-- ----------------------------------------------------------------------------
-- Safe to run more than once (drop-then-create throughout). Run on the TEST
-- project first, then `npm test` (tests/rls/portfolios.test.ts), then
-- production.
--
-- These policies were first created in the Supabase dashboard and lived
-- nowhere in the repo. Two of them were too broad:
--   * "Authenticated users can read portfolio files" let ANY signed-in member
--     read (and list) every portfolio file, including CVs from pending and
--     rejected applicants. Removed.
--   * "Authenticated users can upload portfolio files" let any signed-in member
--     upload into anyone's folder. Replaced with an own-folder rule.
--
-- Who can read portfolio files after this file:
--   * the owner (their own folder),
--   * admins (application review),
--   * anyone, for APPROVED pros only: "Public can read approved pros portfolio
--     files" in supabase/public-profiles.sql (public profiles and project
--     owners' applicant lists; applicants are always approved pros).
-- Files live under `<user id>/…`; the first folder is the owner's id.
-- ============================================================================

-- ── 1. Remove the broad rules ───────────────────────────────────────────────
drop policy if exists "Authenticated users can read portfolio files" on storage.objects;
drop policy if exists "Authenticated users can upload portfolio files" on storage.objects;

-- ── 2. Uploads: your own folder only ────────────────────────────────────────
drop policy if exists "Users upload own portfolio files" on storage.objects;
create policy "Users upload own portfolio files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 3. Reads: the owner, and admins ─────────────────────────────────────────
drop policy if exists "Users can read own portfolio files" on storage.objects;
create policy "Users can read own portfolio files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Admins can read portfolio files" on storage.objects;
create policy "Admins can read portfolio files"
  on storage.objects for select
  using (bucket_id = 'portfolios' and public.is_admin());

-- ── 4. Deletes: your own folder only ────────────────────────────────────────
-- The app uses it only to clean up after an application that failed to save
-- (ENG F13). Storage deletes only files the caller can also read, which §3
-- allows for your own folder.
drop policy if exists "Users delete own portfolio files" on storage.objects;
create policy "Users delete own portfolio files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
