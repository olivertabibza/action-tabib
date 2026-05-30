-- Adds the editable profile fields used by the /profile page.
-- Safe to run more than once (uses IF NOT EXISTS).

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists headline text,
  add column if not exists bio text;

-- Make sure a signed-in user is allowed to update their own row (needed for
-- the profile edit form to save). Harmless if it already exists.
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid()::text = id::text)
  with check (auth.uid()::text = id::text);
