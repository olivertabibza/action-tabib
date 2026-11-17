-- ════════════════════════════════════════════════════════════════════════════
-- ONE-OFF: remove the demo content. Run whenever you no longer want it.
--
-- Removes exactly what 2026-11-17-demo-content.sql added: every project,
-- class, event, article and feed post whose ID starts f1110000-2026-4, and
-- everything that hangs off them through ON DELETE CASCADE (roles,
-- applications, enrollments, reviews, RSVPs, comments, congratulations). That
-- includes real members' applications, enrollments and comments ON that
-- content; the dry run counts them separately so you can see if there are any.
-- Saved items and review notes that point at it go too.
--
-- What stays: the seed accounts (with the profiles that script rewrote), and
-- all other content on the site.
--
-- HOW TO RUN (Supabase dashboard → the LIVE project → SQL Editor):
--   1. Run it as it is. dry_run is true, so it stops with an error that starts
--      "DRY RUN — nothing was changed" and lists what it WOULD delete.
--   2. Check that list. If it's right, change dry_run to false and run again.
--      The last thing it shows is a table of what's left (all zeros).
--
-- One DO block, one statement: if it's a dry run, NOTHING is changed.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ▼▼ EDIT THIS ▼▼ ───────────────────────────────────────────────────────────
  dry_run boolean := true;
  -- ▲▲ EDIT THIS ▲▲ ───────────────────────────────────────────────────────────

  fx constant text := 'f1110000-2026-4';
  report text;
  n int;
begin
  report := E'\nDemo content: '
    || (select count(*) from public.projects where id::text like fx || '%') || ' projects, '
    || (select count(*) from public.classes where id::text like fx || '%') || ' classes, '
    || (select count(*) from public.events where id::text like fx || '%') || ' events, '
    || (select count(*) from public.articles where id::text like fx || '%') || ' articles, '
    || (select count(*) from public.activity_events where id::text like fx || '%') || ' feed posts.'
    || E'\nOther people''s activity on it, which goes too: '
    || (select count(*) from public.applications a
        where a.project_id::text like fx || '%' and a.id::text not like fx || '%') || ' applications, '
    || (select count(*) from public.class_enrollments e
        where e.class_id::text like fx || '%' and e.id::text not like fx || '%') || ' enrollments, '
    || (select count(*) from public.event_rsvps r
        where r.event_id::text like fx || '%' and r.id::text not like fx || '%') || ' RSVPs, '
    || (select count(*) from public.activity_comments c
        where c.event_id::text like fx || '%' and c.id::text not like fx || '%') || ' comments, '
    || (select count(*) from public.saved_items s where s.item_id::text like fx || '%') || ' saved items.';

  -- No foreign key on these, so no cascade: clear them by ID.
  delete from public.saved_items where item_id::text like fx || '%';
  delete from public.review_reasons where item_id::text like fx || '%';
  delete from public.activity_events
  where subject_id::text like fx || '%' and id::text not like fx || '%';

  delete from public.projects where id::text like fx || '%';
  delete from public.classes where id::text like fx || '%';
  delete from public.events where id::text like fx || '%';
  delete from public.articles where id::text like fx || '%';
  delete from public.activity_events where id::text like fx || '%';

  if dry_run then
    raise exception 'DRY RUN — nothing was changed. This is what would be deleted:%', report
      using hint = 'If the list is right, set dry_run := false and run again.';
  end if;
  raise notice 'Done.%', report;
end
$$;

-- What's left of the demo content (all zeros after a real run).
select 'projects' as what, count(*) as remaining from public.projects where id::text like 'f1110000-2026-4%'
union all select 'classes', count(*) from public.classes where id::text like 'f1110000-2026-4%'
union all select 'events', count(*) from public.events where id::text like 'f1110000-2026-4%'
union all select 'articles', count(*) from public.articles where id::text like 'f1110000-2026-4%'
union all select 'feed posts', count(*) from public.activity_events where id::text like 'f1110000-2026-4%'
union all select 'comments', count(*) from public.activity_comments where id::text like 'f1110000-2026-4%';
