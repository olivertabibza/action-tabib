-- ============================================================================
-- Global search v1
-- ----------------------------------------------------------------------------
-- Safe to run more than once (drop-then-create / create or replace).
--
-- Run this ONCE in the Supabase SQL editor, AFTER marketplace.sql, classes.sql
-- and public-profiles.sql: it reuses public.is_approved_pro() (marketplace.sql,
-- also relied on by classes.sql) and reads public.public_profiles
-- (public-profiles.sql), so those must already exist. It also reads
-- public.events / public.articles (content.sql) and public.classes
-- (classes.sql).
--
-- ONE function, public.global_search(q text), returning a uniform row shape
-- across five entity types so a single UI can render every result. It enforces
-- the SAME visibility boundary as the rest of the app:
--
--   PUBLIC (anon, fans, pros):
--     * profiles — approved professionals only, via public_profiles, which
--       already applies account_type='professional' AND
--       application_status='approved'
--     * events   — status='published' only
--     * articles — status='published' only
--
--   PRO-ONLY (returned only when public.is_approved_pro() is true):
--     * projects — status='open' only
--     * classes  — status='published' only
--
-- The pro gate lives INSIDE the function, not in the UI: a fan or anon caller
-- physically cannot get project/class rows back. SECURITY DEFINER is what lets
-- the function read those gated tables after checking is_approved_pro() itself
-- — as everywhere else in this app, the elevated read comes from a
-- security-definer helper, NOT the service-role / secret key.
--
-- Matching is a plain case-insensitive ILIKE substring scan. That is deliberate
-- for v1: no tsvector, no pg_trgm, no extra indexes. Revisit when the tables
-- outgrow a sequential scan.
--
-- Additive and forward-only (mirrors content-review.sql / fan-follows.sql): no
-- other .sql file is touched.
-- ============================================================================

-- Dropped first because a create-or-replace cannot change a function's return
-- type — re-running this file after the returned TABLE shape changes would
-- otherwise fail.
drop function if exists public.global_search(text);

create or replace function public.global_search(q text)
returns table (
  kind     text,   -- 'profile' | 'project' | 'class' | 'event' | 'article'
  id       uuid,
  title    text,
  subtitle text,
  snippet  text
)
language sql
stable
security definer
set search_path = public
as $$
  -- One trimmed term reused by every branch. The length guard is applied per
  -- branch, so a blank or 1-character q matches nothing and the function
  -- returns zero rows.
  with params as (
    select trim(coalesce(q, '')) as term
  ),
  hits as (
    -- profiles: approved pros only (the filter is baked into public_profiles).
    select
      'profile'::text                                        as kind,
      pp.id                                                  as id,
      coalesce(pp.display_name, '')                          as title,
      coalesce(nullif(pp.headline, ''), pp.role, '')         as subtitle,
      coalesce(pp.bio, '')                                   as snippet
    from public.public_profiles pp, params
    where length(params.term) >= 2
      and (
        pp.display_name ilike '%' || params.term || '%'
        or pp.role      ilike '%' || params.term || '%'
        or pp.headline  ilike '%' || params.term || '%'
        or pp.bio       ilike '%' || params.term || '%'
      )

    union all

    -- events: published only, public to everyone.
    select
      'event'::text,
      e.id,
      e.title,
      coalesce(e.venue, ''),
      coalesce(e.description, '')
    from public.events e, params
    where length(params.term) >= 2
      and e.status = 'published'
      and (
        e.title       ilike '%' || params.term || '%'
        or e.description ilike '%' || params.term || '%'
        or e.venue    ilike '%' || params.term || '%'
      )

    union all

    -- articles: published only, public to everyone.
    select
      'article'::text,
      a.id,
      a.title,
      coalesce(a.category, ''),
      coalesce(nullif(a.excerpt, ''), a.body, '')
    from public.articles a, params
    where length(params.term) >= 2
      and a.status = 'published'
      and (
        a.title      ilike '%' || params.term || '%'
        or a.excerpt ilike '%' || params.term || '%'
        or a.body    ilike '%' || params.term || '%'
      )

    union all

    -- projects: PRO-ONLY. is_approved_pro() is the security boundary; without
    -- it this branch contributes no rows at all.
    select
      'project'::text,
      pr.id,
      pr.title,
      coalesce(pr.location, ''),
      coalesce(pr.description, '')
    from public.projects pr, params
    where length(params.term) >= 2
      and public.is_approved_pro()
      and pr.status = 'open'
      and (
        pr.title         ilike '%' || params.term || '%'
        or pr.description ilike '%' || params.term || '%'
        or pr.location    ilike '%' || params.term || '%'
      )

    union all

    -- classes: PRO-ONLY, same gate as projects; published only.
    select
      'class'::text,
      c.id,
      c.title,
      coalesce(c.venue, ''),
      coalesce(c.description, '')
    from public.classes c, params
    where length(params.term) >= 2
      and public.is_approved_pro()
      and c.status = 'published'
      and (
        c.title         ilike '%' || params.term || '%'
        or c.description ilike '%' || params.term || '%'
        or c.venue       ilike '%' || params.term || '%'
      )
  )
  -- People first, then the rest alphabetically by kind, so profiles are never
  -- buried under a long list of content. Capped so one broad term ("a"-ish)
  -- can't return the whole database.
  select h.kind, h.id, h.title, h.subtitle, h.snippet
  from hits h
  order by
    case h.kind when 'profile' then 0 else 1 end,
    h.kind,
    h.title
  limit 40;
$$;

grant execute on function public.global_search(text) to anon, authenticated;
