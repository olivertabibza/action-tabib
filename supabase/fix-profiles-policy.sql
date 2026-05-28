-- Drop existing insert policy and replace with a more explicit one
drop policy if exists "Users can insert their own profile" on public.profiles;

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid()::text = id::text);

-- Also add an update policy so users can update their own profile later
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid()::text = id::text);
