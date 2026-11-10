-- reset_seed_conversation(): TEST PROJECT ONLY ("action-test").
--
-- NEVER run this file on production. Production's copy was dropped on
-- 2026-11-10 (supabase/one-off/2026-11-10-clean-production.sql).
--
-- Used by tests/rls/messages.test.ts to start each run from a fresh thread,
-- since clients can't insert or reset participant rows themselves (see
-- supabase/messages.sql).
--
-- It deletes ONLY the one conversation between the caller and p_other
-- (participants and messages cascade), and ONLY when BOTH people's login emails
-- (auth.users, which users can't edit through the API) end in
-- '@actionseed.test', i.e. both are seed accounts. For anyone else it does
-- nothing. It can't be called with the anon key.
--
-- The action-test project already has it (it was built from the 2026-10-29
-- baseline). Re-run this file there only if the function changes, or when
-- building another test environment from supabase/baseline/.

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
