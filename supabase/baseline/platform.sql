-- Platform objects that `pg_dump --schema=public` doesn't capture: extensions,
-- storage buckets, storage policies, and auth-schema customizations.
-- Snapshot of production taken 2026-10-29 with read-only SELECTs. Idempotent.
-- Apply AFTER public-schema.sql: the storage policies call public functions
-- and read public.profiles. See README.md in this folder.

-- public-schema.sql empties search_path for the session; every name below is
-- schema-qualified, so that's fine.

-- ── Extensions ────────────────────────────────────────────────────────────────
-- Production's non-default extensions. A new Supabase project already has all
-- of these; the statements are here so an older or self-hosted one doesn't
-- miss them. (plpgsql and supabase_vault are built in and platform-managed.)
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ── Storage buckets ───────────────────────────────────────────────────────────
-- portfolios is private (signed URLs); work_samples is public. Neither has a
-- size limit or a MIME allow-list on production.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('portfolios', 'portfolios', false, null, null),
  ('work_samples', 'work_samples', true, null, null)
on conflict (id) do update
  set name = excluded.name,
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Storage policies ──────────────────────────────────────────────────────────
-- Every policy on storage.objects (production has none on storage.buckets).
-- The portfolios ones were created in the dashboard and exist nowhere else in
-- the repo; the work_samples ones mirror supabase/work-samples.sql.

drop policy if exists "Admins can read portfolio files" on storage.objects;
create policy "Admins can read portfolio files" on storage.objects as permissive for select to public
  using (((bucket_id = 'portfolios'::text) AND public.is_admin()));

drop policy if exists "Approved pros upload own work samples" on storage.objects;
create policy "Approved pros upload own work samples" on storage.objects as permissive for insert to public
  with check (((bucket_id = 'work_samples'::text) AND public.is_approved_pro() AND ((storage.foldername(name))[1] = (auth.uid())::text)));

drop policy if exists "Authenticated users can read portfolio files" on storage.objects;
create policy "Authenticated users can read portfolio files" on storage.objects as permissive for select to public
  using (((bucket_id = 'portfolios'::text) AND (auth.role() = 'authenticated'::text)));

drop policy if exists "Authenticated users can upload portfolio files" on storage.objects;
create policy "Authenticated users can upload portfolio files" on storage.objects as permissive for insert to public
  with check (((bucket_id = 'portfolios'::text) AND (auth.role() = 'authenticated'::text)));

drop policy if exists "Owners delete own work samples" on storage.objects;
create policy "Owners delete own work samples" on storage.objects as permissive for delete to public
  using (((bucket_id = 'work_samples'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

drop policy if exists "Public can read approved pros portfolio files" on storage.objects;
create policy "Public can read approved pros portfolio files" on storage.objects as permissive for select to anon, authenticated
  using (((bucket_id = 'portfolios'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE (((p.id)::text = (storage.foldername(objects.name))[1]) AND (p.account_type = 'professional'::text) AND (p.application_status = 'approved'::text))))));

drop policy if exists "Users can read own portfolio files" on storage.objects;
create policy "Users can read own portfolio files" on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'portfolios'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

-- ── Required rows ─────────────────────────────────────────────────────────────
-- The schema-only dump has no rows, but public.platform_settings must hold its
-- one singleton row (nobody can insert it through the API). Same statement as
-- supabase/platform-settings.sql: every switch at its default, false. Not a
-- copy of production's current values.
insert into public.platform_settings (id) values (true)
on conflict (id) do nothing;

-- ── Auth schema ───────────────────────────────────────────────────────────────
-- None: production has no custom triggers or functions in the auth schema
-- (profiles are created by onboarding, not by a trigger on auth.users).
