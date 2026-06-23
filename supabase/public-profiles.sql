-- Public professional profiles
-- Safe to run more than once (create or replace / drop-then-create).
-- Lets logged-out visitors view APPROVED professionals without the secret key.
-- The view exposes only public-safe columns behind a fixed filter, so anon can
-- read it directly while the underlying profiles table stays locked down (no anon
-- policy on it) — keeping email and other fields private.

create or replace view public.public_profiles as
  select id, display_name, role, headline, bio, portfolio_files
  from public.profiles
  where account_type = 'professional'
    and application_status = 'approved';

grant select on public.public_profiles to anon, authenticated;

-- Storage: let anyone read an APPROVED pro's portfolio files so the public page
-- can mint signed URLs with the anon key. Files live in the private "portfolios"
-- bucket under <user_id>/..., so match the first path segment to an approved
-- professional's id. Pending/rejected/consumer files stay private.
drop policy if exists "Public can read approved pros portfolio files" on storage.objects;
create policy "Public can read approved pros portfolio files"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'portfolios'
    and exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[1]
        and p.account_type = 'professional'
        and p.application_status = 'approved'
    )
  );
