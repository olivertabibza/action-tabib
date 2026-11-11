-- ════════════════════════════════════════════════════════════════════════════
-- ONE-OFF: clean test data off PRODUCTION. 2026-11-10.
--
-- PRODUCTION ONLY. Never run this on the action-test project: the tests there
-- need the seed accounts, fixtures and reset_seed_conversation() it removes.
-- It refuses to run anywhere that has no real (non-seed) accounts, and anywhere
-- whose [TEST] counts don't match the inventory below.
--
-- HOW TO RUN (Supabase dashboard → the LIVE project → SQL Editor):
--   1. If you're removing extra accounts, type their login emails into
--      extra_account_emails below. Don't commit those emails anywhere.
--   2. Run it as it is. dry_run is true, so it stops with an error that starts
--      "DRY RUN — nothing was changed" and lists what it WOULD delete.
--   3. Check that list. If it's right, change dry_run to false and run again.
--      The last thing it shows is a table of what's left (all zeros).
--
-- Everything happens inside one DO block, which is one statement: if any check
-- fails, or it's a dry run, NOTHING is changed.
--
-- What it removes (decided 2026-11-10; the 8 approved seed pros STAY as demo
-- members):
--   • [TEST] classes, events, articles and projects left behind by test runs,
--     plus saved items and feed items pointing at them.
--   • The [TEST] feed post, and message threads where every message is [TEST].
--   • Two seed accounts nothing needs any more: seed-admin-1 (the "[TEST]
--     Staff Admin", a real admin login) and seed-pending-1 (a test fixture).
--     Deleting an account deletes everything it owns (ON DELETE CASCADE).
--   • Any extra accounts listed in extra_account_emails.
--   • The test-only function reset_seed_conversation(), which now lives only
--     on the test project (supabase/test-only/).
--
-- Expected counts come from the read-only inventory run on 2026-11-10. If the
-- data changed since, the script stops instead of guessing.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ▼▼ EDIT THESE ▼▼ ──────────────────────────────────────────────────────────
  dry_run boolean := true;
  -- Login emails of extra accounts to delete, e.g.
  --   array['someone@example.com', 'seed-writer-2@actionseed.test']
  extra_account_emails text[] := array[]::text[];
  -- ▲▲ EDIT THESE ▲▲ ──────────────────────────────────────────────────────────

  -- From the 2026-11-10 inventory.
  expected_classes  constant int := 103;
  expected_events   constant int := 70;
  expected_articles constant int := 38;
  expected_projects constant int := 1;
  expected_posts    constant int := 1;
  expected_threads  constant int := 2;

  fixed_seed_emails constant text[] :=
    array['seed-admin-1@actionseed.test', 'seed-pending-1@actionseed.test'];

  class_ids uuid[];  event_ids uuid[];  article_ids uuid[];  project_ids uuid[];
  thread_ids uuid[]; post_ids uuid[];   account_ids uuid[];
  all_emails text[];
  n_thread_msgs int; n_saved int; n_feed_refs int;
  n_found int; n_admin_extra int; n_real_accounts int;
  owned_report text;
  summary text;
begin
  -- ── Guards ────────────────────────────────────────────────────────────────
  select count(*) into n_real_accounts
  from auth.users where email not like '%@actionseed.test';
  if n_real_accounts = 0 then
    raise exception 'Refusing: this project has no real accounts, so it looks like the test project. Run this on PRODUCTION only.';
  end if;

  all_emails := fixed_seed_emails || coalesce(extra_account_emails, array[]::text[]);

  select count(distinct lower(u.email)) into n_found
  from auth.users u where lower(u.email) = any (select lower(e) from unnest(all_emails) e);
  if n_found <> (select count(distinct lower(e)) from unnest(all_emails) e) then
    raise exception 'Refusing: % of the % listed account emails were found. Check extra_account_emails for typos (the two seed accounts must exist too).',
      n_found, (select count(distinct lower(e)) from unnest(all_emails) e);
  end if;

  -- Never delete a real admin by accident. Only seed-admin-1 may be an admin.
  select count(*) into n_admin_extra
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = any (select lower(e) from unnest(extra_account_emails) e)
    and p.is_admin;
  if n_admin_extra > 0 then
    raise exception 'Refusing: % of the extra accounts is an ADMIN. Remove admin rights (or the email) first if you really mean it.', n_admin_extra;
  end if;

  -- ── Collect what goes ─────────────────────────────────────────────────────
  select coalesce(array_agg(id), '{}') into class_ids   from public.classes  where title like '[TEST]%';
  select coalesce(array_agg(id), '{}') into event_ids   from public.events   where title like '[TEST]%';
  select coalesce(array_agg(id), '{}') into article_ids from public.articles where title like '[TEST]%';
  select coalesce(array_agg(id), '{}') into project_ids from public.projects where title like '[TEST]%';
  select coalesce(array_agg(id), '{}') into post_ids    from public.activity_events where body like '[TEST]%';

  -- Threads where EVERY message is [TEST] (and there is at least one).
  select coalesce(array_agg(c.id), '{}') into thread_ids
  from public.conversations c
  where exists (select 1 from public.messages m where m.conversation_id = c.id)
    and not exists (select 1 from public.messages m
                    where m.conversation_id = c.id and m.body not like '[TEST]%');
  select count(*) into n_thread_msgs from public.messages where conversation_id = any (thread_ids);

  if cardinality(class_ids)   <> expected_classes
  or cardinality(event_ids)   <> expected_events
  or cardinality(article_ids) <> expected_articles
  or cardinality(project_ids) <> expected_projects
  or cardinality(post_ids)    <> expected_posts
  or cardinality(thread_ids)  <> expected_threads then
    raise exception 'Refusing: the [TEST] data changed since the inventory. Found classes %, events %, articles %, projects %, feed posts %, test-only threads %; expected %, %, %, %, %, %.',
      cardinality(class_ids), cardinality(event_ids), cardinality(article_ids),
      cardinality(project_ids), cardinality(post_ids), cardinality(thread_ids),
      expected_classes, expected_events, expected_articles,
      expected_projects, expected_posts, expected_threads;
  end if;

  select count(*) into n_saved from public.saved_items s
  where (s.item_type = 'event'   and s.item_id = any (event_ids))
     or (s.item_type = 'article' and s.item_id = any (article_ids))
     or (s.item_type = 'project' and s.item_id = any (project_ids));

  select count(*) into n_feed_refs from public.activity_events a
  where a.subject_id = any (class_ids || event_ids || article_ids || project_ids)
    and not (a.id = any (post_ids));

  select coalesce(array_agg(u.id), '{}') into account_ids
  from auth.users u where lower(u.email) = any (select lower(e) from unnest(all_emails) e);

  -- What each account takes with it, apart from [TEST] content (deleted anyway).
  select string_agg(format('%s (%s): %s projects, %s classes, %s events, %s articles, %s applications, %s messages, %s feed posts',
           coalesce(p.display_name, '(no name)'), split_part(u.email, '@', 2),
           (select count(*) from public.projects x where x.created_by = u.id and x.title not like '[TEST]%'),
           (select count(*) from public.classes  x where x.created_by = u.id and x.title not like '[TEST]%'),
           (select count(*) from public.events   x where x.created_by = u.id and x.title not like '[TEST]%'),
           (select count(*) from public.articles x where x.created_by = u.id and x.title not like '[TEST]%'),
           (select count(*) from public.applications x where x.applicant_id = u.id),
           (select count(*) from public.messages x where x.sender_id = u.id and not (x.conversation_id = any (thread_ids))),
           (select count(*) from public.activity_events x where x.actor_id = u.id and not (x.id = any (post_ids)))),
         ' | ' order by u.email)
    into owned_report
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = any (account_ids);

  summary := format(
    E'[TEST] classes %s, events %s, articles %s, projects %s; saved items pointing at them %s; feed items pointing at them %s; [TEST] feed posts %s; test-only threads %s (%s messages); accounts %s. Each account also takes: %s. Drop the test-only function reset_seed_conversation(): %s.',
    cardinality(class_ids), cardinality(event_ids), cardinality(article_ids), cardinality(project_ids),
    n_saved, n_feed_refs, cardinality(post_ids), cardinality(thread_ids), n_thread_msgs,
    cardinality(account_ids), coalesce(owned_report, 'nothing'),
    case when to_regprocedure('public.reset_seed_conversation(uuid)') is null then 'no, already gone' else 'yes' end);

  if dry_run then
    raise exception 'DRY RUN — nothing was changed. Would delete: %', summary;
  end if;

  -- ── Delete ────────────────────────────────────────────────────────────────
  delete from public.saved_items s
  where (s.item_type = 'event'   and s.item_id = any (event_ids))
     or (s.item_type = 'article' and s.item_id = any (article_ids))
     or (s.item_type = 'project' and s.item_id = any (project_ids));
  delete from public.activity_events
  where id = any (post_ids)
     or subject_id = any (class_ids || event_ids || article_ids || project_ids);
  delete from public.classes       where id = any (class_ids);    -- enrollments, reviews cascade
  delete from public.events        where id = any (event_ids);    -- RSVPs cascade
  delete from public.articles      where id = any (article_ids);
  delete from public.projects      where id = any (project_ids);  -- roles, applications cascade
  delete from public.conversations where id = any (thread_ids);   -- participants, messages cascade
  delete from auth.users           where id = any (account_ids);  -- profiles and all they own cascade
  execute 'drop function if exists public.reset_seed_conversation(uuid)';

  raise notice 'Deleted: %', summary;
end;
$$;

-- What's left (run after the real run; every count should be 0).
select 'classes [TEST]' as what, count(*) as remaining from public.classes where title like '[TEST]%'
union all select 'events [TEST]', count(*) from public.events where title like '[TEST]%'
union all select 'articles [TEST]', count(*) from public.articles where title like '[TEST]%'
union all select 'projects [TEST]', count(*) from public.projects where title like '[TEST]%'
union all select 'feed posts [TEST]', count(*) from public.activity_events where body like '[TEST]%'
union all select 'messages [TEST]', count(*) from public.messages where body like '[TEST]%'
union all select 'seed-admin-1 + seed-pending-1', count(*) from auth.users
  where email in ('seed-admin-1@actionseed.test', 'seed-pending-1@actionseed.test')
union all select 'reset_seed_conversation()', count(*) from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'reset_seed_conversation';
