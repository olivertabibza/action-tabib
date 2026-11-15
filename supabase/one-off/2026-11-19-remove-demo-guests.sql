-- ════════════════════════════════════════════════════════════════════════════
-- ONE-OFF: remove the live-event demo guests. 2026-11-19.
--
-- Deletes every ANONYMOUS auth user (Supabase anonymous sign-in, from /demo;
-- see supabase/demo-guests.sql) and everything they created. Seed and real
-- accounts all have an email, so they are never selected, and the script
-- refuses to run if any selected account looks like one.
--
-- HOW TO RUN (Supabase dashboard → SQL Editor, on the project to clean):
--   1. Turn demo mode OFF on /admin/settings first, so no new guest appears
--      mid-run.
--   2. Run it as it is. dry_run is true, so it stops with an error that starts
--      "DRY RUN — nothing was changed" and lists what it WOULD delete.
--   3. Check that list. If it's right, change dry_run to false and run again.
--      The last thing it shows is a table of what's left (all zeros).
--
-- Everything happens inside one DO block, which is one statement: if any check
-- fails, or it's a dry run, NOTHING is changed.
--
-- What goes:
--   • The anonymous auth users. Their profiles, and everything that references
--     a profile (applications, enrollments, posts, comments, reactions,
--     projects, classes, events, articles, saved items, follows, connections,
--     messages and threads, RSVPs, reviews, work samples), go with them through
--     ON DELETE CASCADE.
--   • Other members' rows that only exist because of a guest go too, through
--     the same cascades: applications to a guest's project, enrollments in a
--     guest's class, comments on a guest's post, a member's messages in a
--     thread with a guest. They are counted separately below.
--   • Saved items and feed items that point at a guest's project, class, event
--     or article (item_id / subject_id have no foreign key, so no cascade).
--
-- What stays: uploaded files. Storage refuses deletes from SQL, so the dry run
-- reports how many files guests left behind; remove them in Dashboard →
-- Storage if the count isn't 0.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ▼▼ EDIT THIS ▼▼ ───────────────────────────────────────────────────────────
  dry_run boolean := true;
  -- ▲▲ EDIT THIS ▲▲ ───────────────────────────────────────────────────────────

  guest_ids uuid[];
  guest_texts text[];
  content_ids uuid[];
  n_unsafe int; n_flag_mismatch int;
  report text;
begin
  select coalesce(array_agg(id), '{}') into guest_ids
  from auth.users where is_anonymous;
  guest_texts := guest_ids::text[];

  -- ── Safety: only true anonymous guests ────────────────────────────────────
  -- An anonymous user that somehow has an email or password, or an admin
  -- profile, is not a plain guest: stop rather than guess.
  select count(*) into n_unsafe
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = any (guest_ids)
    and (coalesce(u.email, '') <> ''
         or coalesce(u.encrypted_password, '') <> ''
         or coalesce(p.is_admin, false));
  if n_unsafe > 0 then
    raise exception 'STOPPED — % anonymous account(s) have an email, a password or admin rights. Nothing was changed.', n_unsafe;
  end if;

  -- A guest-flagged profile on a non-anonymous account, or an anonymous
  -- account with a non-guest profile, means something else went wrong.
  select count(*) into n_flag_mismatch
  from public.profiles p
  where (p.is_demo_guest and not (p.id = any (guest_ids)))
     or (p.id = any (guest_ids) and not p.is_demo_guest);
  if n_flag_mismatch > 0 then
    raise exception 'STOPPED — % profile(s) where is_demo_guest disagrees with the account being anonymous. Nothing was changed.', n_flag_mismatch;
  end if;

  select coalesce(array_agg(id), '{}') into content_ids from (
    select id from public.projects where created_by = any (guest_ids)
    union all select id from public.classes  where created_by = any (guest_ids)
    union all select id from public.events   where created_by = any (guest_ids)
    union all select id from public.articles where created_by = any (guest_ids)
  ) c;

  -- ── What would go ─────────────────────────────────────────────────────────
  select format(
    E'anonymous users: %s\nguest profiles: %s\n'
    'their applications: %s\ntheir enrollments: %s\ntheir posts: %s\ntheir comments: %s\n'
    'their projects: %s\ntheir classes: %s\ntheir events: %s\ntheir articles: %s\n'
    'their saved items: %s\ntheir messages: %s\n'
    'OTHER MEMBERS'' rows that go with them: applications to guest projects: %s, '
    'enrollments in guest classes: %s, comments on guest posts: %s, '
    'messages in threads with a guest: %s, saved/feed items pointing at guest content: %s\n'
    'storage files guests left behind (NOT deleted): %s',
    cardinality(guest_ids),
    (select count(*) from public.profiles where id = any (guest_ids)),
    (select count(*) from public.applications where applicant_id = any (guest_ids)),
    (select count(*) from public.class_enrollments where user_id = any (guest_ids)),
    (select count(*) from public.activity_events where actor_id = any (guest_ids)),
    (select count(*) from public.activity_comments where author_id = any (guest_ids)),
    (select count(*) from public.projects where created_by = any (guest_ids)),
    (select count(*) from public.classes where created_by = any (guest_ids)),
    (select count(*) from public.events where created_by = any (guest_ids)),
    (select count(*) from public.articles where created_by = any (guest_ids)),
    (select count(*) from public.saved_items where user_id = any (guest_ids)),
    (select count(*) from public.messages where sender_id = any (guest_ids)),
    (select count(*) from public.applications a join public.projects p on p.id = a.project_id
       where p.created_by = any (guest_ids) and not (a.applicant_id = any (guest_ids))),
    (select count(*) from public.class_enrollments e join public.classes c on c.id = e.class_id
       where c.created_by = any (guest_ids) and not (e.user_id = any (guest_ids))),
    (select count(*) from public.activity_comments m join public.activity_events v on v.id = m.event_id
       where v.actor_id = any (guest_ids) and not (m.author_id = any (guest_ids))),
    (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id
       where (c.user_a = any (guest_ids) or c.user_b = any (guest_ids))
         and not (m.sender_id = any (guest_ids))),
    (select (select count(*) from public.saved_items
              where item_id = any (content_ids) and not (user_id = any (guest_ids)))
          + (select count(*) from public.activity_events
              where subject_id = any (content_ids) and not (actor_id = any (guest_ids)))),
    (select count(*) from storage.objects
       where owner_id = any (guest_texts)
          or (storage.foldername(name))[1] = any (guest_texts))
  ) into report;

  if dry_run then
    raise exception E'DRY RUN — nothing was changed. Would delete:\n%', report;
  end if;

  -- ── Delete ────────────────────────────────────────────────────────────────
  delete from public.saved_items where item_id = any (content_ids);
  delete from public.activity_events where subject_id = any (content_ids);
  delete from auth.users where id = any (guest_ids);

  raise notice E'Deleted:\n%', report;
end $$;

-- What's left (all zeros after a real run).
select
  (select count(*) from auth.users where is_anonymous)        as anonymous_users,
  (select count(*) from public.profiles where is_demo_guest)  as guest_profiles;
