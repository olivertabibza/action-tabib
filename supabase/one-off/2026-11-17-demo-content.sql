-- ════════════════════════════════════════════════════════════════════════════
-- ONE-OFF: replace the demo content on PRODUCTION. 2026-11-17.
--
-- For the live demo on 2026-11-19. Guests should see a busy, believable film
-- community and no test data. This script, in one statement:
--   1. Deletes the test accounts you list in delete_account_emails, and
--      everything they own (projects, posts, applications, messages…).
--   2. Deletes the open projects named in delete_project_titles, whoever owns
--      them ("Test tabib", "Lead Actor").
--   3. Wipes everything the seed accounts (seed-*@actionseed.test) have
--      posted: projects, classes, events, articles, feed posts, comments,
--      applications, enrollments, RSVPs, saved items, and message threads
--      between two seed accounts. The accounts themselves, their follows,
--      connections and endorsements stay.
--   4. Rewrites the 8 approved seed pros' headlines and bios.
--   5. Adds new content from those 8: 15 projects with their roles, 8 classes,
--      6 events, 8 articles and 20 feed posts, plus the applications,
--      enrollments, RSVPs, reviews, comments and congratulations that make it
--      look lived-in. Dates are relative to when you run it: posts in the last
--      two weeks, classes and events from December to February.
--
-- Every new row has a fixed ID starting f1110000-2026-4, so
-- 2026-11-17-remove-demo-content.sql can remove exactly this content later
-- without touching anything else. Running this script again wipes and
-- re-adds it, with dates refreshed.
--
-- Names, venues and companies are made up, so nobody turns up at a real place
-- for a fake event.
--
-- HOW TO RUN (Supabase dashboard → the LIVE project → SQL Editor):
--   1. Type the test accounts' login emails into delete_account_emails below.
--      Only accounts you're sure are yours. Don't commit those emails.
--   2. Run it as it is. dry_run is true, so it stops with an error that starts
--      "DRY RUN — nothing was changed" and lists what it WOULD delete and add.
--   3. Check that list. If it's right, change dry_run to false and run again.
--      The last thing it shows is a table of what guests will now see.
--
-- Everything happens inside one DO block, which is one statement: if any check
-- fails, or it's a dry run, NOTHING is changed.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ▼▼ EDIT THESE ▼▼ ──────────────────────────────────────────────────────────
  dry_run boolean := true;
  -- Login emails of test accounts to delete, e.g.
  --   array['you+test1@example.com', 'you+test2@example.com']
  delete_account_emails text[] := array[]::text[];
  -- Open projects to delete by exact title, whoever owns them.
  delete_project_titles text[] := array['Test tabib', 'Lead Actor'];
  -- ▲▲ EDIT THESE ▲▲ ──────────────────────────────────────────────────────────

  fx constant text := 'f1110000-2026-4';  -- every new row's ID starts with this
  d0 constant timestamp := date_trunc('day', now() at time zone 'America/New_York');
  seed_all uuid[];
  del_ids uuid[];
  n int;
  problems text;
  report text := '';
begin
  -- ── Checks ────────────────────────────────────────────────────────────────
  create temp table _p (key text primary key, id uuid not null) on commit drop;
  insert into _p (key, id)
  select substring(u.email from '^seed-(.*)@actionseed\.test$'), u.id
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.email in (
      'seed-actor-1@actionseed.test', 'seed-actor-2@actionseed.test',
      'seed-writer-1@actionseed.test', 'seed-director-1@actionseed.test',
      'seed-producer-1@actionseed.test', 'seed-cinematographer-1@actionseed.test',
      'seed-editor-1@actionseed.test', 'seed-composer-1@actionseed.test')
    and p.account_type = 'professional'
    and p.application_status = 'approved';
  if (select count(*) from _p) <> 8 then
    raise exception 'Expected the 8 approved seed pros, found %. Nothing was changed.',
      (select count(*) from _p);
  end if;

  select coalesce(array_agg(u.id), '{}') into seed_all
  from auth.users u where u.email like 'seed-%@actionseed.test';

  -- Accounts to delete: each must exist once, have a profile, and not be a
  -- seed account, an admin or a demo guest.
  select string_agg(e, ', ') into problems
  from unnest(delete_account_emails) e
  where (select count(*) from auth.users u
         join public.profiles p on p.id = u.id
         where lower(u.email) = lower(btrim(e))
           and u.email not like 'seed-%@actionseed.test'
           and not p.is_admin
           and not coalesce(u.is_anonymous, false)) <> 1;
  if problems is not null then
    raise exception 'These emails are not deletable test accounts (not found, a seed account, an admin or a guest): %. Nothing was changed.', problems;
  end if;
  select coalesce(array_agg(u.id), '{}') into del_ids
  from auth.users u
  where lower(u.email) = any (select lower(btrim(e)) from unnest(delete_account_emails) e);

  -- ── 1. Test accounts ──────────────────────────────────────────────────────
  if cardinality(del_ids) > 0 then
    report := report || E'\nAccounts deleted, with everything they own:';
    select report || string_agg(E'\n  • ' || coalesce(nullif(p.display_name, ''), '(no name)')
             || ' <' || p.email || '>, ' || coalesce(p.account_type, '?') || ' '
             || coalesce(p.application_status, ''), '' order by p.display_name)
      into report
    from public.profiles p where p.id = any (del_ids);
  end if;
  delete from auth.users where id = any (del_ids);

  -- ── 2. Test projects by title ─────────────────────────────────────────────
  -- (A listed project owned by a deleted account is already gone with it.)
  select string_agg(E'\n  • "' || pr.title || '" by '
           || coalesce(nullif(p.display_name, ''), '(no name)'), '')
    into problems
  from public.projects pr join public.profiles p on p.id = pr.created_by
  where pr.title = any (delete_project_titles) and pr.id::text not like fx || '%';
  delete from public.projects
  where title = any (delete_project_titles) and id::text not like fx || '%';
  get diagnostics n = row_count;
  report := report || E'\nProjects deleted by title: ' || n || coalesce(problems, '');
  problems := null;

  -- ── 3. Wipe what the seed accounts posted ────────────────────────────────
  report := report || E'\nSeed content removed:';
  delete from public.projects where created_by = any (seed_all);  -- roles, applications cascade
  get diagnostics n = row_count; report := report || ' projects ' || n;
  delete from public.applications where applicant_id = any (seed_all);
  get diagnostics n = row_count; report := report || ', applications ' || n;
  delete from public.classes where created_by = any (seed_all);   -- enrollments, reviews cascade
  get diagnostics n = row_count; report := report || ', classes ' || n;
  delete from public.class_enrollments where user_id = any (seed_all);
  delete from public.class_reviews where reviewer_id = any (seed_all);
  delete from public.events where created_by = any (seed_all);    -- RSVPs cascade
  get diagnostics n = row_count; report := report || ', events ' || n;
  delete from public.event_rsvps where user_id = any (seed_all);
  delete from public.articles where created_by = any (seed_all);
  get diagnostics n = row_count; report := report || ', articles ' || n;
  delete from public.activity_events where actor_id = any (seed_all);  -- comments, reactions cascade
  get diagnostics n = row_count; report := report || ', feed posts ' || n;
  delete from public.activity_comments where author_id = any (seed_all);
  delete from public.activity_reactions where actor_id = any (seed_all);
  delete from public.saved_items where user_id = any (seed_all);
  delete from public.conversations
  where user_a = any (seed_all) and user_b = any (seed_all);       -- messages cascade
  get diagnostics n = row_count; report := report || ', seed-to-seed threads ' || n;

  -- Leftovers that pointed at deleted content (no foreign key, so no cascade).
  delete from public.saved_items s
  where (s.item_type = 'project' and not exists (select 1 from public.projects x where x.id = s.item_id))
     or (s.item_type = 'event'   and not exists (select 1 from public.events   x where x.id = s.item_id))
     or (s.item_type = 'article' and not exists (select 1 from public.articles x where x.id = s.item_id));
  delete from public.activity_events e
  where (e.kind in ('project_posted', 'project_booked')
         and e.subject_id is not null
         and not exists (select 1 from public.projects x where x.id = e.subject_id))
     or (e.kind = 'class_enrolled'
         and e.subject_id is not null
         and not exists (select 1 from public.classes x where x.id = e.subject_id));
  delete from public.review_reasons r
  where (r.item_type = 'class'   and not exists (select 1 from public.classes  x where x.id = r.item_id))
     or (r.item_type = 'event'   and not exists (select 1 from public.events   x where x.id = r.item_id))
     or (r.item_type = 'article' and not exists (select 1 from public.articles x where x.id = r.item_id));

  -- ── 4. The 8 members' profiles ────────────────────────────────────────────
  update public.profiles p
  set role = v.role, skills = v.skills, headline = v.headline, bio = v.bio
  from (values
    ('actor-1', 'actor', array['actor'],
     $t$Actor — grounded drama and dark comedy, New York$t$,
     $t$Meisner-trained, with six years in New York's off-off-Broadway scene before moving to screen. Recent work includes three festival shorts and a recurring role in an indie web series. I turn self-tapes around within 24 hours and teach an on-camera audition intensive.$t$),
    ('actor-2', 'actor', array['actor', 'writer'],
     $t$Actor and writer — physical comedy, character work, improv$t$,
     $t$Clown and movement training, ten years of improv, and a soft spot for stories that are funny until they suddenly aren't. I co-write most of what I perform in. Currently shooting the pilot for Back of House, a kitchen comedy series.$t$),
    ('writer-1', 'writer', array['writer', 'producer'],
     $t$Screenwriter — contained thrillers and character-driven drama$t$,
     $t$I write tight, single-location stories designed to be made, not just read. Two shorts produced, a feature thriller (Undertow) in development with a director attached, and a comedy series (The Understudy) heading into production this winter.$t$),
    ('director-1', 'director', array['director', 'writer'],
     $t$Director — naturalistic drama, performance first$t$,
     $t$I started in music videos and documentary, and now make narrative work with actors at the center. Four shorts on the festival circuit. Prepping my first feature, Saltwater, for a spring shoot on the North Fork of Long Island.$t$),
    ('producer-1', 'producer', array['producer', 'director'],
     $t$Producer — budgets, schedules and films that actually finish$t$,
     $t$Line producer turned producer, with a feature, a docuseries and more than a dozen shorts delivered on time and on budget. I run the Winter Shorts Lab, which pairs first-time directors with experienced crews. Always looking for reliable department heads.$t$),
    ('cinematographer-1', 'cinematographer', array['cinematographer', 'videographer'],
     $t$Cinematographer — natural light, handheld, documentary instinct$t$,
     $t$I shoot narrative, documentary and branded work with a small, fast crew. Own an Alexa Mini kit and a set of vintage lenses I refuse to sell. Currently finishing Hollow Ground, a feature documentary about community gardens in the Bronx.$t$),
    ('editor-1', 'editor', array['editor', 'sound_designer'],
     $t$Editor — narrative shorts, documentaries, and the fix in post$t$,
     $t$I cut in Avid and Resolve and I'm happiest finding the film in difficult footage. Credits include two feature documentaries, a dozen narrative shorts and more music videos than I can count. I also teach a narrative editing workshop.$t$),
    ('composer-1', 'composer', array['composer', 'sound_designer'],
     $t$Composer — strings, synths and scores that leave room$t$,
     $t$I write for film, animation and theater, mixing small string ensembles with analog synths and found sound. Seven shorts and two documentaries scored in the last two years. My debut album is out this winter, starting with the single Paper Moons.$t$)
  ) as v(key, role, skills, headline, bio)
  join _p on _p.key = v.key
  where p.id = _p.id;

  -- ── 5. New content ────────────────────────────────────────────────────────
  -- Projects. posted_at is spread over the last two weeks.
  insert into public.projects
    (id, created_by, title, project_type, location, compensation, pay_min, pay_max,
     pay_unit, tags, staff_pick, description, disciplines, discipline, status,
     posted_at, created_at)
  select (fx || 'a01-8111-' || lpad(v.n::text, 12, '0'))::uuid, _p.id, v.title,
         v.project_type, v.location, v.compensation, v.pay_min, v.pay_max, v.pay_unit,
         v.tags, v.staff_pick, v.description, v.disciplines, v.disciplines[1], 'open',
         now() - make_interval(hours => v.hours_ago), now() - make_interval(hours => v.hours_ago)
  from (values
    (1, 'director-1', 'Saltwater', 'feature_film', 'North Fork, NY', 'paid', 350, 600, 'day',
     array['Drama', 'Feature', 'SAG-AFTRA Ultra Low Budget', 'Housing provided'], true, 40,
     $t$Debut feature from director Léo Marchetti. Two estranged sisters come home to the North Fork to save their late father's oyster farm, and find out how little of it is left. 18 shoot days in March, mostly exteriors on the water. SAG-AFTRA Ultra Low Budget agreement. Housing and meals provided for the whole shoot.$t$,
     array['actor', 'cinematographer', 'sound_operator']),
    (2, 'producer-1', 'Night Shift', 'short_film', 'Jackson Heights, Queens, NY', 'paid', 300, 500, 'day',
     array['Thriller', 'Night shoot', '3 days', 'Queens'], false, 96,
     $t$A 15-minute thriller set in a 24-hour laundromat between 2 and 5 a.m. The overnight attendant realizes the man silently folding his clothes has been there every night for a week. Three overnight shoot days in January. Meals, a car home after wrap, and full credit.$t$,
     array['actor', 'cinematographer']),
    (3, 'writer-1', 'The Understudy', 'web_series', 'Midtown Manhattan, NY', 'paid', 250, 400, 'day',
     array['Comedy', '6 episodes', 'Ensemble', 'Theater world'], false, 140,
     $t$A six-episode comedy about the understudy in a long-running Broadway flop, who has learned every role in the show and has never once gone on. Scripts are locked. Shooting over two weeks in February inside a working theater.$t$,
     array['actor', 'director', 'makeup_artist']),
    (4, 'cinematographer-1', 'Hollow Ground', 'documentary', 'The Bronx, NY', 'paid', 1200, 1600, 'week',
     array['Feature doc', 'Observational', 'Community', '4 months'], false, 200,
     $t$Feature documentary following three community gardens in the South Bronx through a full growing season, and the neighbors fighting to keep them. We've shot spring through fall and are heading into the edit. Looking for two people to join the core team for the next four months.$t$,
     array['producer', 'editor']),
    (5, 'composer-1', 'Paper Moons', 'music_video', 'Greenpoint, Brooklyn, NY', 'paid', 1500, 2500, 'project',
     array['Music video', 'One day', 'Choreography', '16mm'], false, 70,
     $t$Music video for Paper Moons, the lead single from my debut album. One continuous dance sequence through an empty print shop, shot on 16mm. One shoot day in December, plus a rehearsal day the week before.$t$,
     array['director', 'actor', 'editor']),
    (6, 'producer-1', 'Brightline Coffee — Spring Campaign', 'commercial', 'Manhattan, NY', 'paid', 800, 1200, 'day',
     array['Commercial', 'Union rates', '2 days', 'Usage buyout'], true, 22,
     $t$Two-day shoot for a regional coffee roaster's spring campaign: three 30-second spots and a set of social cutdowns. Morning-light café interiors and a rooftop. Agency and client on set. Talent rates include a one-year usage buyout.$t$,
     array['actor', 'cinematographer', 'costume_designer']),
    (7, 'producer-1', 'Winter Shorts Lab — Crew Call', 'crew_call', 'Brooklyn, NY', 'paid', 200, 350, 'day',
     array['4 short films', 'January weekends', 'Mentorship', 'Paid crew'], false, 110,
     $t$We're producing four short films by first-time directors over four weekends in January, each backed by an experienced crew. Paid day rates, proper meals and a credit on all four films. Apply for one weekend or all of them.$t$,
     array['cinematographer', 'sound_operator', 'costume_designer', 'makeup_artist']),
    (8, 'actor-2', 'Last Call at the Starlite', 'short_film', 'Ridgewood, Queens, NY', 'deferred', null, null, null,
     array['Comedy', 'Single location', '2 nights', 'Festival budget'], false, 180,
     $t$A comedy short about the last night of a neighborhood bowling alley, told entirely from behind its bar. Written by and starring Desmond Okafor. Two nights in December at an alley that's lending us its lanes after closing. Deferred pay, with the festival budget already raised.$t$,
     array['actor', 'editor']),
    (9, 'writer-1', 'Undertow', 'feature_film', 'New York, NY', 'deferred', null, null, null,
     array['Thriller', 'Feature', 'Packaging', 'Director attached'], false, 260,
     $t$A contained psychological thriller set over one storm-bound weekend in a lake house. The script has placed in two screenwriting competitions and has a director attached. Looking for a producer and a casting director to package it for financing next year.$t$,
     array['producer']),
    (10, 'actor-1', 'Small Hours', 'short_film', 'Lower East Side, New York, NY', 'deferred', null, null, null,
     array['Drama', 'Two-hander', 'Self-produced', 'Rehearsal-led'], false, 160,
     $t$A two-hander I've been developing with my scene partner for a year: two old friends, one apartment, the night before one of them moves across the country. We have the script, the space and the cast. Now we need the people who'll make it look like a film.$t$,
     array['director', 'cinematographer']),
    (11, 'editor-1', 'Signal Fire', 'short_film', 'Remote', 'paid', 1000, 1800, 'project',
     array['Sci-fi', 'Post-production', 'VFX', 'Remote'], false, 220,
     $t$Picture-locked 18-minute sci-fi short about a lighthouse keeper who starts hearing radio calls from a ship that sank in 1952. Looking for three post-production collaborators to finish it for a spring festival run. All work is remote.$t$,
     array['editor', 'sound_designer', 'composer']),
    (12, 'cinematographer-1', 'Field Notes — Northway Outfitters', 'commercial', 'Hudson Valley, NY', 'paid', 650, 900, 'day',
     array['Branded documentary', '3 days', 'Outdoors', 'Small crew'], false, 250,
     $t$Three-day branded documentary for an outdoor gear company, following a volunteer trail crew rebuilding a ridge path in the Hudson Valley. Small crew, a lot of hiking, beautiful light. Transport from the city provided.$t$,
     array['cinematographer', 'videographer']),
    (13, 'director-1', 'Rehearsal Room', 'short_film', 'Chelsea, New York, NY', 'paid', 400, 650, 'day',
     array['Drama', 'Two-hander', 'SAG-AFTRA', 'Long takes'], false, 300,
     $t$A chamber piece about two actors in their fifties rehearsing a love scene twenty years after their real affair ended. One location, two days in February, shot in long takes. SAG-AFTRA Short Project agreement.$t$,
     array['actor']),
    (14, 'actor-2', 'Back of House', 'web_series', 'Bushwick, Brooklyn, NY', 'deferred', null, null, null,
     array['Comedy', 'Pilot', 'Ensemble', 'Restaurant'], false, 280,
     $t$Pilot for a comedy series set in the kitchen of a Brooklyn restaurant that's one bad review from closing. We shoot over three nights in a real kitchen after service, then take the pilot to festivals and streamers.$t$,
     array['actor']),
    (15, 'composer-1', 'Tidewater — Voice Cast', 'other', 'Midtown Manhattan, NY', 'paid', 150, 250, 'hour',
     array['Animation', 'Voice acting', 'Studio sessions', 'Remote OK'], false, 330,
     $t$Casting voices for Tidewater, an 11-minute animated short I'm scoring, about a fox who runs the last ferry across a flooded city. Recording sessions at a studio in Midtown in January. Remote sessions are possible with a good home setup.$t$,
     array['actor'])
  ) as v(n, owner, title, project_type, location, compensation, pay_min, pay_max, pay_unit,
         tags, staff_pick, hours_ago, description, disciplines)
  join _p on _p.key = v.owner;

  -- Roles, in display order. ID = project number × 100 + position.
  insert into public.project_roles
    (id, project_id, name, billing, gender, age_min, age_max, discipline, description, status, sort_order)
  select (fx || 'a02-8111-' || lpad((v.pn * 100 + v.ord)::text, 12, '0'))::uuid,
         (fx || 'a01-8111-' || lpad(v.pn::text, 12, '0'))::uuid,
         v.name, v.billing, v.gender, v.age_min, v.age_max, v.discipline, v.description, 'open', v.ord
  from (values
    (1, 1, 'June', 'lead', 'female', 28, 38, 'actor',
     $t$The younger sister. Left for the city at eighteen and never looked back. Sharp, funny, defended. Must be comfortable on small boats.$t$),
    (1, 2, 'Claire', 'lead', 'female', 35, 45, 'actor',
     $t$The older sister, who stayed. Practical and exhausted, holding the farm and the family together with tape.$t$),
    (1, 3, 'Walt', 'supporting', 'male', 60, 75, 'actor',
     $t$Their father's oldest friend and the farm's last employee. Few words, all of them true.$t$),
    (1, 4, '1st Assistant Camera', 'crew', 'any', null, null, 'cinematographer',
     $t$Alexa Mini LF with vintage primes. Experience pulling focus on moving water is a big plus.$t$),
    (1, 5, 'Production Sound Mixer', 'crew', 'any', null, null, 'sound_operator',
     $t$Wind, water and outboard motors. Bring your own kit; kit fee paid on top of your rate.$t$),
    (2, 1, 'Inés', 'lead', 'female', 25, 35, 'actor',
     $t$The overnight attendant, studying for her nursing exams between cycles. Watchful, tired and braver than she thinks.$t$),
    (2, 2, 'The Regular', 'supporting', 'male', 40, 60, 'actor',
     $t$Never speaks above a murmur. A role built on presence rather than dialogue.$t$),
    (2, 3, 'Gaffer', 'crew', 'any', null, null, 'cinematographer',
     $t$Practical fluorescents and one big source outside the window. Small package, careful with power.$t$),
    (2, 4, 'Key Grip', 'crew', 'any', null, null, null,
     $t$Tight interior, lots of flagging and a slow push-in on the final shot.$t$),
    (3, 1, 'Wren', 'lead', 'any', 24, 32, 'actor',
     $t$The understudy. Knows every line, every cue and every exit. Has never been seen by an audience.$t$),
    (3, 2, 'Dolores', 'supporting', 'female', 55, 70, 'actor',
     $t$The show's fading star, who refuses to miss a single performance out of pure spite. Recurring.$t$),
    (3, 3, 'Director, Episodes 1–3', 'crew', 'any', null, null, 'director',
     $t$Comedy with a heart. Ensemble experience and a reel with timing we can feel.$t$),
    (3, 4, 'Hair & Makeup Artist', 'crew', 'any', null, null, 'makeup_artist',
     $t$Stage looks that hold up under film lights, plus quick changes between scenes.$t$),
    (4, 1, 'Field Producer', 'crew', 'any', null, null, 'producer',
     $t$Schedule pickup shoots, keep relationships with the gardeners warm, and manage releases. Spanish is a strong plus.$t$),
    (4, 2, 'Assistant Editor', 'crew', 'any', null, null, 'editor',
     $t$Organize 300+ hours of footage: syncing, transcripts and string-outs. Premiere or Resolve.$t$),
    (5, 1, 'Director', 'crew', 'any', null, null, 'director',
     $t$Someone who loves movement and long takes. A treatment is welcome but not required to apply.$t$),
    (5, 2, 'Lead Dancer', 'lead', 'any', 20, 35, 'actor',
     $t$Contemporary or modern training. The video is a single two-minute take, so stamina matters.$t$),
    (5, 3, 'Colorist', 'crew', 'any', null, null, 'editor',
     $t$16mm scans with a warm, slightly faded look. Remote is fine.$t$),
    (6, 1, 'Barista (hero)', 'lead', 'any', 25, 40, 'actor',
     $t$Warm, quick and natural with their hands. Real café experience is a bonus.$t$),
    (6, 2, 'The Regular', 'supporting', 'any', 60, 80, 'actor',
     $t$A one-line spot built around a forty-year morning ritual.$t$),
    (6, 3, 'Steadicam Operator', 'crew', 'any', null, null, 'cinematographer',
     $t$Half a day on each day for the long café move. Own rig required.$t$),
    (6, 4, 'Wardrobe Stylist', 'crew', 'any', null, null, 'costume_designer',
     $t$Earth tones, no logos, three looks per principal.$t$),
    (7, 1, 'Gaffer', 'crew', 'any', null, null, 'cinematographer',
     $t$Lead a small electric team on one or more of the four shorts.$t$),
    (7, 2, 'Production Sound Mixer', 'crew', 'any', null, null, 'sound_operator',
     $t$Dialogue-heavy shorts in real locations. Kit fee paid.$t$),
    (7, 3, 'Costume Designer', 'crew', 'any', null, null, 'costume_designer',
     $t$Contemporary wardrobe on a modest budget, with one period dream sequence.$t$),
    (7, 4, 'Makeup Artist', 'crew', 'any', null, null, 'makeup_artist',
     $t$Naturalistic beauty plus one horror short with some light prosthetics.$t$),
    (7, 5, 'Script Supervisor', 'crew', 'any', null, null, null,
     $t$Continuity and notes for first-time directors who will lean on you.$t$),
    (8, 1, 'Earl', 'supporting', 'male', 60, 75, 'actor',
     $t$Has bowled here every Thursday since 1981 and is not taking the news well.$t$),
    (8, 2, 'Bev', 'supporting', 'female', 40, 55, 'actor',
     $t$The owner. Selling up, pouring free drinks and pretending she's fine.$t$),
    (8, 3, 'Editor', 'crew', 'any', null, null, 'editor',
     $t$Comedy timing in the cut matters more than anything here.$t$),
    (9, 1, 'Producer', 'crew', 'any', null, null, 'producer',
     $t$Experience packaging and financing a low-budget feature. Deferred fee plus backend.$t$),
    (9, 2, 'Casting Director', 'crew', 'any', null, null, null,
     $t$Help us attach two recognizable leads. Fee paid on financing.$t$),
    (10, 1, 'Director', 'crew', 'any', null, null, 'director',
     $t$Someone who loves rehearsal and trusts actors. Two shoot days in January.$t$),
    (10, 2, 'Cinematographer', 'crew', 'any', null, null, 'cinematographer',
     $t$One apartment, practical light, intimate coverage. Your own kit preferred.$t$),
    (11, 1, 'VFX Compositor', 'crew', 'any', null, null, 'editor',
     $t$About 40 shots: sky replacements, screen inserts and one big storm.$t$),
    (11, 2, 'Sound Designer', 'crew', 'any', null, null, 'sound_designer',
     $t$Radio static, sea, and a lighthouse that creaks like it's alive.$t$),
    (11, 3, 'Composer', 'crew', 'any', null, null, 'composer',
     $t$Sparse and eerie, with room for the sound design to breathe.$t$),
    (12, 1, 'B-Camera Operator', 'crew', 'any', null, null, 'cinematographer',
     $t$Handheld documentary coverage on steep trails. FX6 provided.$t$),
    (12, 2, 'Drone Operator', 'crew', 'any', null, null, 'videographer',
     $t$Part 107 certified, with your own aircraft and insurance.$t$),
    (13, 1, 'Anna', 'lead', 'female', 48, 60, 'actor',
     $t$A celebrated stage actor who has never forgiven him. Or herself.$t$),
    (13, 2, 'Marcus', 'lead', 'male', 48, 60, 'actor',
     $t$Charming, careful and still hoping she'll say what he needs to hear.$t$),
    (14, 1, 'Chef Ray', 'lead', 'male', 35, 50, 'actor',
     $t$Brilliant, broke and three days from losing the restaurant his mother built.$t$),
    (14, 2, 'Paz', 'supporting', 'any', 20, 30, 'actor',
     $t$The line cook who actually runs the kitchen and lets Ray think otherwise.$t$),
    (14, 3, 'Production Designer', 'crew', 'any', null, null, null,
     $t$Dress a real restaurant kitchen to look like it's falling apart, then put it back by morning.$t$),
    (15, 1, 'The Ferrywoman (voice)', 'lead', 'female', 25, 45, 'actor',
     $t$Dry, wry and a little weary. She also narrates the film.$t$),
    (15, 2, 'The Stranger (voice)', 'supporting', 'male', 30, 60, 'actor',
     $t$A passenger who won't say where he's going. Warm voice with something hidden underneath.$t$)
  ) as v(pn, ord, name, billing, gender, age_min, age_max, discipline, description);

  -- Applications between members, so owners have applicants to look at.
  insert into public.applications (id, project_id, applicant_id, role_id, note, created_at)
  select (fx || 'a03-8111-' || lpad(v.n::text, 12, '0'))::uuid,
         (fx || 'a01-8111-' || lpad(v.pn::text, 12, '0'))::uuid,
         _p.id,
         case when v.ord is null then null
              else (fx || 'a02-8111-' || lpad((v.pn * 100 + v.ord)::text, 12, '0'))::uuid end,
         v.note, now() - make_interval(hours => v.hours_ago)
  from (values
    (1, 1, 1, 'actor-1', 20,
     $t$I spent summers working on a clam boat out east, so the water won't scare me. I'd love to read for June.$t$),
    (2, 2, 1, 'actor-1', 80,
     $t$Overnight thrillers are my favorite kind of tension. I can have a self-tape to you within a day.$t$),
    (3, 3, 3, 'director-1', 120,
     $t$Ensemble comedy is a departure for me, and that's exactly why I want it. Happy to shoot a test scene with two of your actors.$t$),
    (4, 3, 1, 'actor-2', 130,
     $t$I've understudied twice in real life. I know this person in my bones.$t$),
    (5, 5, 1, 'director-1', 60,
     $t$I came up in music videos and miss them. A dance oner on 16mm is a dream brief. Treatment attached in my messages.$t$),
    (6, 2, 3, 'cinematographer-1', 90,
     $t$I gaff when I'm not shooting, and I have a fluorescent kit that suits this location exactly.$t$),
    (7, 11, 3, 'composer-1', 200,
     $t$Eerie and sparse is where I live. I'd love to see the locked cut.$t$),
    (8, 4, 2, 'editor-1', 180,
     $t$Organizing a mountain of observational footage is my favorite kind of puzzle. Available from December.$t$),
    (9, 9, 1, 'producer-1', 240,
     $t$Contained thrillers are some of the easiest features to finance right now. Let's talk numbers.$t$),
    (10, 10, 2, 'cinematographer-1', 150,
     $t$One apartment, practical light and actors who've rehearsed for a year. Yes, please.$t$),
    (11, 8, 3, 'editor-1', 170,
     $t$Comedy lives in the cut. I'd love to read the script.$t$),
    (12, 14, null, 'writer-1', 260,
     $t$If you're building a writers' room for the series, I'd love to help shape the episode outlines.$t$),
    (13, 6, 3, 'cinematographer-1', 18,
     $t$I've operated Steadicam on two coffee spots this year. Own rig, and I can do both days.$t$)
  ) as v(n, pn, ord, applicant, hours_ago, note)
  join _p on _p.key = v.applicant;

  -- Classes, December to February, at New York times.
  insert into public.classes
    (id, created_by, title, description, discipline, format, venue, level, price_cents,
     capacity, starts_at, status, created_at)
  select (fx || 'b01-8111-' || lpad(v.n::text, 12, '0'))::uuid, _p.id, v.title, v.description,
         v.discipline, v.format, v.venue, v.level, v.price_cents, v.capacity,
         (d0 + make_interval(days => v.days, hours => v.hour, mins => v.mins)) at time zone 'America/New_York',
         'published', now() - make_interval(days => v.listed_days_ago)
  from (values
    (1, 'actor-1', 'On-Camera Audition Intensive', 'actor', 'in_person',
     'The Rehearsal Loft, Chelsea, New York', 'intermediate', 8500, 24, 18, 11, 0, 9,
     $t$A full-day intensive on the audition room and the self-tape. We work sides both cold and prepared, on camera, with playback and specific notes after every take. You'll leave with two polished tapes and a prep routine you can repeat on your own.$t$),
    (2, 'cinematographer-1', 'Self-Tape Lab: Light, Sound & Framing at Home', 'actor', 'virtual',
     '', 'beginner', 3500, 80, 22, 19, 0, 6,
     $t$A cinematographer's guide to a self-tape setup that costs less than one headshot. Together we build a small home kit: one key light, a bounce, a lav mic and a background that doesn't distract. Bring your phone and whatever lamps you own.$t$),
    (3, 'writer-1', 'Writing the Contained Thriller (4 weeks)', 'writer', 'virtual',
     '', 'intermediate', 18000, 40, 51, 19, 0, 12,
     $t$A four-week workshop on writing a feature that can actually be made on a small budget: one location, a small cast and pressure that keeps building. Weekly pages, live notes and a table read of your first act in the final session.$t$),
    (4, 'director-1', 'Directing Actors: From Rehearsal to Set', 'director', 'in_person',
     'Gowanus Arts Studio, Brooklyn, NY', 'all', 9500, 30, 54, 10, 0, 4,
     $t$How to talk to actors so it actually helps. We cover reading a scene for action rather than emotion, running rehearsals, giving notes between takes, and protecting performances when the day gets tight. Working actors join us for live scene work in the afternoon.$t$),
    (5, 'producer-1', 'Budgeting & Scheduling Your First Short', 'producer', 'virtual',
     '', 'beginner', 0, 100, 25, 13, 0, 15,
     $t$A free, practical session on turning a script into a schedule, and a schedule into a budget. We break down a real short together, build a three-day shooting schedule and a line-item budget, and talk about where first-time producers usually lose money.$t$),
    (6, 'editor-1', 'Cutting for Rhythm: Editing Narrative Shorts', 'editor', 'virtual',
     '', 'intermediate', 6000, 50, 65, 19, 0, 3,
     $t$We take one scene from dailies to fine cut in a single evening and talk through every decision: where to enter a scene, when to stay on the listener, and how to cut for performance rather than coverage. Bring your own footage for a group review.$t$),
    (7, 'composer-1', 'Scoring to Picture: Spotting Sessions & Temp Tracks', 'composer', 'in_person',
     'Room 3 Studios, Greenpoint, Brooklyn, NY', 'advanced', 7500, 20, 79, 18, 30, 2,
     $t$For composers, and the directors who work with them, who want their first spotting session to go well. We spot a short film together, talk honestly about temp love, then write and record a cue to picture in the room.$t$),
    (8, 'actor-2', 'Physical Comedy & Movement for Screen', 'actor', 'in_person',
     'Studio Nine, Lower East Side, New York', 'all', 6500, 24, 68, 14, 0, 7,
     $t$Clown and movement work adapted for the camera, where a small gesture reads big. We play with status, timing and the body in close-up. Wear clothes you can move in. No comedy experience needed.$t$)
  ) as v(n, owner, title, discipline, format, venue, level, price_cents, capacity, days, hour,
         mins, listed_days_ago, description)
  join _p on _p.key = v.owner;

  insert into public.class_enrollments (id, class_id, user_id, created_at)
  select (fx || 'b02-8111-' || lpad((v.cn * 100 + row_number() over (partition by v.cn order by v.who))::text, 12, '0'))::uuid,
         (fx || 'b01-8111-' || lpad(v.cn::text, 12, '0'))::uuid, _p.id,
         now() - make_interval(hours => 12 + v.cn * 7)
  from (values
    (1, 'actor-2'), (1, 'writer-1'), (1, 'composer-1'),
    (2, 'actor-1'), (2, 'actor-2'), (2, 'director-1'), (2, 'writer-1'),
    (3, 'director-1'), (3, 'actor-2'), (3, 'producer-1'),
    (4, 'actor-1'), (4, 'writer-1'), (4, 'producer-1'), (4, 'cinematographer-1'),
    (5, 'director-1'), (5, 'writer-1'), (5, 'composer-1'), (5, 'editor-1'), (5, 'actor-1'),
    (6, 'director-1'), (6, 'cinematographer-1'),
    (7, 'director-1'), (7, 'editor-1'),
    (8, 'actor-1'), (8, 'writer-1'), (8, 'composer-1')
  ) as v(cn, who)
  join _p on _p.key = v.who;

  -- Reviews from earlier sessions of the classes that run regularly.
  insert into public.class_reviews (id, class_id, reviewer_id, rating, body, created_at)
  select (fx || 'b03-8111-' || lpad(v.n::text, 12, '0'))::uuid,
         (fx || 'b01-8111-' || lpad(v.cn::text, 12, '0'))::uuid, _p.id, v.rating, v.body,
         now() - make_interval(days => v.days_ago)
  from (values
    (1, 1, 'actor-2', 5, 20,
     $t$Best audition notes I've had outside a real casting room. I booked a callback with the tape I made that day.$t$),
    (2, 1, 'writer-1', 5, 23,
     $t$Took it as a writer to understand actors better. It changed how I write sides.$t$),
    (3, 1, 'composer-1', 4, 26,
     $t$Generous, specific feedback. I wish it ran a little longer.$t$),
    (4, 5, 'director-1', 5, 31,
     $t$Hana broke down my actual script and found two thousand dollars I didn't need to spend.$t$),
    (5, 5, 'editor-1', 5, 33,
     $t$Clear, practical and free. Every first-time producer should take this.$t$),
    (6, 2, 'actor-1', 4, 15,
     $t$My self-tapes look like I hired a crew. Great value.$t$)
  ) as v(n, cn, who, rating, days_ago, body)
  join _p on _p.key = v.who;

  -- Events, December to February.
  insert into public.events (id, created_by, title, description, venue, event_type, starts_at, status, created_at)
  select (fx || 'c01-8111-' || lpad(v.n::text, 12, '0'))::uuid, _p.id, v.title, v.description,
         v.venue, v.event_type,
         (d0 + make_interval(days => v.days, hours => v.hour, mins => v.mins)) at time zone 'America/New_York',
         'published', now() - make_interval(days => v.listed_days_ago)
  from (values
    (1, 'cinematographer-1', 'Crew Up: Camera & Lighting Mixer', 'mixer',
     'Ground Floor Bar, Gowanus, Brooklyn, NY', 16, 19, 0, 6,
     $t$Drinks and reel-swapping for camera, grip and electric. DPs looking for gaffers, gaffers looking for their next DP, and anyone who wants to talk about lenses for three hours.$t$),
    (2, 'producer-1', 'Winter Shorts Showcase + Filmmaker Q&A', 'screening',
     'The Paper Mill Screening Room, Bushwick, Brooklyn, NY', 23, 19, 30, 10,
     $t$Seven new shorts made by Action members this year, followed by a Q&A with the directors and a drinks reception. Doors at 7, films start at 7:30 sharp.$t$),
    (3, 'writer-1', $t$Writers' Night: Live Table Read of "Undertow"$t$, 'q_and_a',
     'The Rehearsal Loft, Chelsea, New York', 29, 18, 30, 5,
     $t$Six actors read the first act of Priya Nair's thriller Undertow, then we open the floor for notes. Hear how a contained feature plays out loud, and give and get honest feedback.$t$),
    (4, 'director-1', 'From Short to Feature: Packaging Your First Film', 'panel',
     'Virtual', 58, 18, 30, 8,
     $t$A director, a producer and a sales agent on what it takes to turn a festival short into a financed first feature: proof of concept, attachments, budgets and the pitch deck. Live Q&A at the end.$t$),
    (5, 'composer-1', 'Composers & Directors Speed-Meet', 'mixer',
     'Room 3 Studios, Greenpoint, Brooklyn, NY', 72, 19, 0, 3,
     $t$Ten-minute conversations between composers and directors with projects in development. Bring a reel or a rough cut on your phone. Everyone leaves with at least five new collaborators.$t$),
    (6, 'producer-1', 'Microbudget Film Weekend', 'festival',
     'The Paper Mill Screening Room, Bushwick, Brooklyn, NY', 95, 12, 0, 12,
     $t$Two days of feature films made for under $50,000, with panels between blocks on financing, crewing and distribution for tiny budgets. Weekend passes for members.$t$)
  ) as v(n, owner, title, event_type, venue, days, hour, mins, listed_days_ago, description)
  join _p on _p.key = v.owner;

  insert into public.event_rsvps (id, event_id, user_id, created_at)
  select (fx || 'c02-8111-' || lpad((v.en * 100 + row_number() over (partition by v.en order by v.who))::text, 12, '0'))::uuid,
         (fx || 'c01-8111-' || lpad(v.en::text, 12, '0'))::uuid, _p.id,
         now() - make_interval(hours => 6 + v.en * 5)
  from (values
    (1, 'director-1'), (1, 'producer-1'), (1, 'editor-1'),
    (2, 'actor-1'), (2, 'actor-2'), (2, 'director-1'), (2, 'writer-1'), (2, 'cinematographer-1'), (2, 'composer-1'),
    (3, 'actor-1'), (3, 'actor-2'), (3, 'producer-1'),
    (4, 'writer-1'), (4, 'producer-1'), (4, 'actor-1'),
    (5, 'director-1'), (5, 'editor-1'),
    (6, 'director-1'), (6, 'writer-1'), (6, 'cinematographer-1')
  ) as v(en, who)
  join _p on _p.key = v.who;

  -- Articles, newest first by created_at.
  insert into public.articles (id, created_by, title, category, excerpt, body, status, created_at)
  select (fx || 'd01-8111-' || lpad(v.n::text, 12, '0'))::uuid, _p.id, v.title, v.category,
         v.excerpt, v.body, 'published', now() - make_interval(days => v.days_ago)
  from (values
    (1, 'actor-1', 'The self-tape checklist casting directors actually use', 'craft', 2,
     $t$Clean sound, a steady frame and a quick slate matter more than production value.$t$,
     $t$Casting offices now see far more tapes than in-person auditions, and the people watching them decide fast. After a year of asking casting directors what makes them keep watching, the answers came down to the same handful of things.

Sound first. A clean, close audio track beats a beautiful image every time. Turn off the fridge, hang a blanket behind the camera, and put the mic or phone closer than feels natural.

Keep the frame steady and simple. Mid-chest to just above the head, eyeline just off the lens, camera at eye height. No moving camera, and no props unless the scene needs them.

Slate in ten seconds. Your name, plus height or location only if they ask. Then go straight into the scene.

Use a real reader. Someone off camera who gives you something to play off is worth more than a perfect location. Ask them to read quietly so they don't overpower your audio.

Make one clear choice. Casting wants to see that you can commit to a choice. If they want another take, they'll ask.

None of this costs money. It just takes the same care you'd bring to a set.$t$),
    (2, 'writer-1', 'Hana Sørensen on finishing films nobody else would', 'interview', 5,
     $t$The producer behind the Winter Shorts Lab on schedules, budgets and the power of saying no.$t$,
     $t$Hana Sørensen has delivered a feature, a docuseries and more than a dozen shorts, all of them on schedule. We sat down with her ahead of this winter's Shorts Lab.

What does a producer actually do on a short film?
"Everything nobody else wants to do. Permits, insurance, the call sheet at 2 a.m., the conversation with the landlord who changed his mind. My job is to make sure the director only has to think about the film."

Where do first-time filmmakers lose money?
"Overtime and locations. People schedule ten-hour days and shoot fourteen. And they fall in love with a location two hours away, then pay for a van, gas and hotel rooms. Shoot near the subway when you can."

Why start the Shorts Lab?
"Talented first-time directors keep making their first film with a crew of friends who are also learning. The Lab pairs them with experienced department heads, so the mistakes they make are creative ones, not technical ones."

What's the most useful word in producing?
"No. Said early, kindly and with an alternative. 'No, we can't afford the crane shot, but here's how we get the same feeling with a ladder.'"

Crew applications for the January Lab are open now under Projects.$t$),
    (3, 'cinematographer-1', 'Lighting a night exterior with three lights and a battery', 'craft', 9,
     $t$A small, quiet package that looks bigger than it is, and won't get you kicked off the block.$t$,
     $t$Most low-budget night exteriors look the same: one harsh light from the camera's direction and black everywhere else. You can do much better with very little.

Start with what's already there. Streetlights, shop windows and car headlights are free fill. Scout at the time you'll shoot and choose the angle where those practicals do the most work.

Then add three things. A soft key: an LED panel through diffusion, placed where a believable source might be, like a shop window or a doorway. A backlight: a small, hard light behind your actors to separate them from the dark. And a bounce: a white board, or even a car sunshade, to lift the shadow side of the face.

Power it all from a portable power station. No generator means no noise and no neighbors complaining.

Finally, expose for the highlights and let the shadows go. Night should feel like night. If you can see everything, you've lit it like day.

The whole package fits in a hatchback, and two people can move it between setups in under ten minutes.$t$),
    (4, 'actor-2', $t$Inside Brooklyn's microcinema boom$t$, 'scene_report', 13,
     $t$Back rooms, co-ops and rented basements where new films find their first audiences.$t$,
     $t$On a Tuesday night in Bushwick, sixty people sit on folding chairs in a former print shop to watch seven short films nobody outside the room has seen. The projector is borrowed. The popcorn is free. The Q&A runs longer than the films.

Rooms like this one have multiplied across Brooklyn and Queens in the last two years. Most seat fewer than a hundred people and run on volunteers, cheap rent and the goodwill of filmmakers who show up for each other's work.

The programming is the draw. With no box office to answer to, programmers take chances on experimental work, unfinished cuts and genre shorts that would never make it past a festival screener.

For filmmakers, the value is the audience. "You learn more about your film in one screening with strangers than in ten with friends," one director told me between blocks. "You can feel exactly where you lose them."

These rooms are also where crews get built. Half the conversations after the screening I went to were about next projects: who's shooting in January, who needs a gaffer, whose script is ready for a table read.

If you've never been, go. Bring cash for the donation jar and stay for the Q&A.$t$),
    (5, 'producer-1', 'Winter Shorts Lab opens crew applications for January', 'news', 18,
     $t$Four first-time directors, four January weekends and a paid crew for every shoot.$t$,
     $t$The Winter Shorts Lab is back for its second year, and crew applications are now open.

The Lab pairs four first-time directors with experienced department heads to make four short films over four weekends in January. Every crew member is paid a day rate, fed properly and credited on all four films.

This year's directors were chosen from more than 200 submissions. Their films include a two-hander on a stalled subway train, a documentary portrait of a Queens tailor, a horror short set in an all-night car wash, and a family comedy during a blackout.

We're hiring gaffers, sound mixers, costume designers, makeup artists, script supervisors and first ADs. You can apply for one weekend or all four.

"We want people who are great at their jobs and generous with what they know," said producer Hana Sørensen, who runs the Lab. "The directors are learning. The crew is there to make that possible."

The four films will premiere together at a showcase screening in the spring. Find the crew call under Projects.$t$),
    (6, 'composer-1', 'What really happens in a spotting session', 'craft', 24,
     $t$Where the music goes, where it doesn't, and why the temp track is everyone's problem.$t$,
     $t$A spotting session is the meeting where the director and composer watch the locked cut together and decide where music goes. It's often the most important conversation about a film's score, and many first-time directors don't know it exists.

We watch the film from start to finish, stopping wherever either of us feels music might belong. For each moment we note where the cue starts, where it ends and what it's for. Not "something sad," but "we need to feel she's made up her mind before she says it."

The most useful thing a director can bring is a clear sense of what each scene is doing. The least useful is a temp track they've grown attached to. Temp music is a helpful sketch, but after weeks in the edit it starts to sound like the only possible answer. Tell your composer which temp cues you love and why, then let them find something that belongs to your film.

Silence is part of the score. Some of the best decisions in a spotting session are about where music should stop, or never start at all.

Leave with a spotting list you've both agreed on and a date for the first cues. Everything after that is easier.$t$),
    (7, 'editor-1', 'Start the scene later than you think', 'craft', 30,
     $t$Most first cuts open every scene too early. Here's how to find the real first frame.$t$,
     $t$In almost every first cut I see, scenes start too early. A character walks in, sits down, says hello, and only then does the scene begin. By then the audience has worked out where we are and is waiting for something to happen.

Try this: find the first line or action where something changes, and start there. Then watch it with someone who hasn't seen the film. If they're lost, back up a few seconds. Usually they won't be.

The same goes for endings. Leave a scene as soon as its question has been answered. The goodbye, the door closing and the walk to the car can usually go. If the next scene starts mid-conversation, the audience fills in the gap themselves, and the film gains momentum without anyone noticing.

This isn't about cutting for speed. Some scenes need to breathe, and long takes can be powerful. It's about making sure every moment on screen is doing something.

When a film feels slow, the fix is rarely in the middle of scenes. It's almost always at the edges.$t$),
    (8, 'actor-1', 'Desmond Okafor on clowning, comedy and saying yes', 'interview', 38,
     $t$The actor and writer behind Back of House on why the funniest work starts in the body.$t$,
     $t$Desmond Okafor trained as a clown before he ever stood in front of a camera. Now he's writing and starring in two comedies of his own: the short Last Call at the Starlite and the series pilot Back of House.

Why clowning?
"Clown teaches you that the audience is your scene partner. You're not performing at them, you're playing with them. On camera, the audience is the lens. Same idea, just smaller."

What changes when you write for yourself?
"I stop protecting the character. When someone else writes the jokes, I want to make them land. When I write them, I'm happy to cut my own best line if it helps the scene."

How do you choose projects?
"I say yes a lot, especially to people early in their careers. Half the directors I worked with on student films are making features now. You never know which set you're on."

What's next?
"We shoot the Back of House pilot in a real kitchen after service. Real heat, real noise, eight actors and a lot of flour. And I'm teaching a movement class in January for actors who think they aren't funny. They usually are."$t$)
  ) as v(n, owner, title, category, days_ago, excerpt, body)
  join _p on _p.key = v.owner;

  -- Feed posts over the last two weeks.
  insert into public.activity_events (id, actor_id, kind, body, metadata, created_at)
  select (fx || 'e01-8111-' || lpad(v.n::text, 12, '0'))::uuid, _p.id, 'status_update', v.body,
         '{}'::jsonb, now() - make_interval(hours => v.hours_ago)
  from (values
    (1, 'director-1', 3,
     $t$Final location locked for Saltwater: a working oyster farm on the North Fork whose owners have read the script twice and cried both times. We shoot in March. Casting is open now.$t$),
    (2, 'producer-1', 7,
     $t$The Brightline Coffee spring campaign is a go. Two days, three spots, one very good rooftop. Casting the hero barista this week.$t$),
    (3, 'composer-1', 20,
     $t$Mixed the final version of Paper Moons tonight. Now I need someone to make a dance film out of it. Directors who love a long take, come find me.$t$),
    (4, 'cinematographer-1', 26,
     $t$Last shoot day of the season on Hollow Ground. Six months, three gardens, about 300 hours of footage. The edit starts in two weeks and we're hiring an assistant editor.$t$),
    (5, 'writer-1', 40,
     $t$The Understudy scripts are locked. Six episodes, one theater, and an ensemble I can't wait to cast. Looking for a director for the first block.$t$),
    (6, 'actor-1', 50,
     $t$Booked a supporting role in a feature shooting upstate in January. Two years of self-tapes from my bathroom and it finally happened. Back to learning lines on the G train.$t$),
    (7, 'editor-1', 70,
     $t$Signal Fire is picture-locked at 18 minutes. Now I need a composer, a sound designer and someone who can sink a 1950s ship convincingly.$t$),
    (8, 'actor-2', 80,
     $t$Table read for Back of House last night: eight actors crammed around a prep counter. The funniest three hours of my year. We shoot the pilot in December.$t$),
    (9, 'producer-1', 100,
     $t$Winter Shorts Lab crew applications are open. Four first-time directors, four January weekends, paid crews. If you've been waiting to step up to department head, this is it.$t$),
    (10, 'director-1', 120,
     $t$Spent the day on a boat with our DP testing lenses against the light on the water. Everything flares. Everything is beautiful. Nothing is in focus. Prep is going great.$t$),
    (11, 'composer-1', 140,
     $t$Delivered stems for a documentary this morning: two cellos, a broken piano and a ferry engine pitched down an octave. Best brief I've had all year.$t$),
    (12, 'writer-1', 165,
     $t$Undertow made the semifinals of a second screenwriting competition. More importantly, we have a director attached. Now looking for a producer who loves a contained thriller.$t$),
    (13, 'cinematographer-1', 190,
     $t$Tip for anyone shooting at night on a budget: a portable power station and one good LED panel through diffusion will get you further than you think. Writing up my full setup this week.$t$),
    (14, 'actor-1', 210,
     $t$Teaching the On-Camera Audition Intensive again in December. Last group's tapes got three callbacks in a week. Small group, lots of playback, honest notes.$t$),
    (15, 'editor-1', 240,
     $t$Rewatched the first cut of a short I edited three years ago. Today I'd cut every scene in half. Growth, or just less patience?$t$),
    (16, 'actor-2', 265,
     $t$The bowling alley said yes. We get the whole place after closing for two nights in December. Last Call at the Starlite is happening.$t$),
    (17, 'director-1', 290,
     $t$Rehearsal Room is cast in my head and nowhere else. If you're an actor in your fifties who has ever had to kiss an ex on stage, we should talk.$t$),
    (18, 'producer-1', 310,
     $t$Delivered our docuseries to the distributor today, on time and two percent under budget. Not glamorous, but it's the post I'm proudest of this year.$t$),
    (19, 'composer-1', 330,
     $t$Looking for voice actors for Tidewater, an animated short about a fox who runs the last ferry across a flooded city. Studio sessions in Midtown in January.$t$),
    (20, 'editor-1', 345,
     $t$Teaching Cutting for Rhythm in January: one scene, from dailies to fine cut, in a single evening. Bring footage you're stuck on.$t$)
  ) as v(n, who, hours_ago, body)
  join _p on _p.key = v.who;

  -- Comments (one level of replies), each newer than its post.
  insert into public.activity_comments (id, event_id, author_id, parent_id, body, created_at)
  select (fx || 'e02-8111-' || lpad(v.n::text, 12, '0'))::uuid,
         (fx || 'e01-8111-' || lpad(v.post::text, 12, '0'))::uuid, _p.id,
         case when v.parent is null then null
              else (fx || 'e02-8111-' || lpad(v.parent::text, 12, '0'))::uuid end,
         v.body, now() - make_interval(mins => (v.hours_ago * 60)::int)
  from (values
    (1, 1, null, 'actor-1', 2.5, $t$Reading for June this week. Already practicing my oyster shucking.$t$),
    (2, 1, 1, 'director-1', 2.0, $t$You're our oyster consultant either way.$t$),
    (3, 1, null, 'producer-1', 1.5, $t$When the owners cry at the script, you've found your location.$t$),
    (4, 3, null, 'director-1', 18, $t$Sending you a treatment tonight.$t$),
    (5, 3, 4, 'composer-1', 17, $t$Can't wait to read it. The print shop is already booked.$t$),
    (6, 4, null, 'editor-1', 24, $t$300 hours! Sending you my reel for the assistant editor role.$t$),
    (7, 6, null, 'actor-2', 48, $t$So proud of you. Drinks on me after our table read.$t$),
    (8, 6, null, 'producer-1', 47, $t$Huge. Well deserved.$t$),
    (9, 7, null, 'composer-1', 68, $t$Applied. Eerie and sparse is my love language.$t$),
    (10, 9, null, 'cinematographer-1', 98, $t$Shared with every gaffer I know.$t$),
    (11, 12, null, 'producer-1', 160, $t$Let's get coffee this week. I have thoughts on financing.$t$),
    (12, 12, 11, 'writer-1', 158, $t$Thursday morning works for me.$t$),
    (13, 16, null, 'actor-1', 260, $t$I will bowl in the background for free.$t$)
  ) as v(n, post, parent, who, hours_ago, body)
  join _p on _p.key = v.who;

  -- Congratulations on the milestone posts.
  insert into public.activity_reactions (event_id, actor_id, kind, created_at)
  select (fx || 'e01-8111-' || lpad(v.post::text, 12, '0'))::uuid, _p.id, 'congratulate',
         now() - make_interval(hours => v.hours_ago)
  from (values
    (1, 'actor-1', 2), (1, 'producer-1', 2), (1, 'cinematographer-1', 1), (1, 'writer-1', 1),
    (2, 'director-1', 6), (2, 'actor-1', 5),
    (4, 'director-1', 25), (4, 'editor-1', 24), (4, 'producer-1', 22),
    (5, 'director-1', 39), (5, 'actor-2', 38), (5, 'producer-1', 36),
    (6, 'actor-2', 49), (6, 'director-1', 48), (6, 'producer-1', 47), (6, 'writer-1', 45), (6, 'composer-1', 44),
    (7, 'composer-1', 69), (7, 'director-1', 66),
    (8, 'actor-1', 79), (8, 'writer-1', 77),
    (9, 'cinematographer-1', 99), (9, 'director-1', 97), (9, 'editor-1', 95),
    (12, 'producer-1', 164), (12, 'director-1', 162), (12, 'actor-1', 160),
    (16, 'actor-1', 264), (16, 'producer-1', 262),
    (18, 'director-1', 309), (18, 'writer-1', 305), (18, 'cinematographer-1', 300)
  ) as v(post, who, hours_ago)
  join _p on _p.key = v.who;

  -- ── Report ────────────────────────────────────────────────────────────────
  report := report || E'\nNew content: '
    || (select count(*) from public.projects where id::text like fx || '%') || ' projects, '
    || (select count(*) from public.project_roles where id::text like fx || '%') || ' roles, '
    || (select count(*) from public.applications where id::text like fx || '%') || ' applications, '
    || (select count(*) from public.classes where id::text like fx || '%') || ' classes, '
    || (select count(*) from public.class_enrollments where id::text like fx || '%') || ' enrollments, '
    || (select count(*) from public.class_reviews where id::text like fx || '%') || ' reviews, '
    || (select count(*) from public.events where id::text like fx || '%') || ' events, '
    || (select count(*) from public.event_rsvps where id::text like fx || '%') || ' RSVPs, '
    || (select count(*) from public.articles where id::text like fx || '%') || ' articles, '
    || (select count(*) from public.activity_events where id::text like fx || '%') || ' feed posts, '
    || (select count(*) from public.activity_comments where id::text like fx || '%') || ' comments.'
    || E'\nMember profiles rewritten: 8.';

  if dry_run then
    raise exception 'DRY RUN — nothing was changed. This is what would happen:%', report
      using hint = 'If the list is right, set dry_run := false and run again.';
  end if;
  raise notice 'Done.%', report;
end
$$;

-- What a guest sees now.
select 'members guests can see' as check_name,
       string_agg(coalesce(nullif(display_name, ''), '(no name)'), ', ' order by display_name) as value
from public.profiles
where account_type = 'professional' and application_status = 'approved'
  and not is_admin and not is_demo_guest
union all select 'open projects', count(*)::text from public.projects where status = 'open'
union all select 'upcoming published classes', count(*)::text from public.classes where status = 'published' and starts_at > now()
union all select 'upcoming published events', count(*)::text from public.events where status = 'published' and starts_at > now()
union all select 'published articles', count(*)::text from public.articles where status = 'published'
union all select 'feed posts by members', count(*)::text from public.activity_events e
  join public.profiles p on p.id = e.actor_id where not p.is_demo_guest;
