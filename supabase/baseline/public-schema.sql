--
-- PostgreSQL database dump
--

\restrict De1hB8WwciKosuSMgyQ0NsIRE1S8xNNiSALbjphxiBMwk95khIDACc1fQ2aStDj

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- baseline fix: pg_dump writes each object's grants relative to Postgres's
-- built-in default (owner only), but a Supabase project's default privileges
-- grant anon/authenticated/service_role ALL on every new object in public.
-- Left alone, those extra grants would undo the revokes below (profiles.email,
-- conversation inserts, anon EXECUTE). Turn them off while objects are created;
-- the ALTER DEFAULT PRIVILEGES lines at the end of this file restore them.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM postgres, anon, authenticated, service_role;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- CREATE SCHEMA public;  -- baseline fix: every Supabase project already has it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: admin_profile_emails(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_profile_emails(p_ids uuid[]) RETURNS TABLE(id uuid, email text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select u.id, u.email::text
  from auth.users u
  where u.id = any (p_ids)
    and public.is_admin();
$$;


--
-- Name: applications_check_role_project(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.applications_check_role_project() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.role_id is not null
     and not public.role_belongs_to_project(new.role_id, new.project_id) then
    raise exception
      'applications: role_id % does not belong to project %',
      new.role_id, new.project_id;
  end if;
  return new;
end;
$$;


--
-- Name: are_connected(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.are_connected(target uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.connections c
    where c.pair_lo = least(auth.uid(), target)
      and c.pair_hi = greatest(auth.uid(), target)
      and c.status = 'accepted'
  );
$$;


--
-- Name: auto_approve_enabled(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_approve_enabled(kind text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((
    select case kind
      when 'pro_applications' then s.auto_approve_pro_applications
      when 'classes' then s.auto_approve_classes
      when 'events' then s.auto_approve_events
      when 'articles' then s.auto_approve_articles
      else false
    end
    from public.platform_settings s
    where s.id
  ), false);
$$;


--
-- Name: can_view_event(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_event(eid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.activity_events e
    where e.id = eid
      and (e.actor_id = auth.uid() or public.is_following(e.actor_id))
  );
$$;


--
-- Name: can_view_project(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_view_project(p_project_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        (p.status = 'open' and public.is_approved_pro())
        or p.created_by = auth.uid()
        or public.has_applied(p.id)
      )
  );
$$;


--
-- Name: circle_applied_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.circle_applied_count(p_project_id uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(distinct a.applicant_id)
  from public.applications a
  join public.connections c
    on c.status = 'accepted'
   and ((c.requester_id = auth.uid() and c.addressee_id = a.applicant_id)
     or (c.addressee_id = auth.uid() and c.requester_id = a.applicant_id))
  where a.project_id = p_project_id;
$$;


--
-- Name: circle_applied_counts(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.circle_applied_counts(p_project_ids uuid[]) RETURNS TABLE(project_id uuid, applied_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select a.project_id, count(distinct a.applicant_id)
  from public.applications a
  join public.connections c
    on c.status = 'accepted'
   and ((c.requester_id = auth.uid() and c.addressee_id = a.applicant_id)
     or (c.addressee_id = auth.uid() and c.requester_id = a.applicant_id))
  where a.project_id = any(p_project_ids)
  group by a.project_id;
$$;


--
-- Name: circle_enrolled_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.circle_enrolled_count(p_class_id uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*)
  from public.class_enrollments ce
  join public.connections c
    on c.status = 'accepted'
   and ((c.requester_id = auth.uid() and c.addressee_id = ce.user_id)
     or (c.addressee_id = auth.uid() and c.requester_id = ce.user_id))
  where ce.class_id = p_class_id;
$$;


--
-- Name: class_seats_taken(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.class_seats_taken(p_class_id uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*) from public.class_enrollments where class_id = p_class_id;
$$;


--
-- Name: comment_is_top_level(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.comment_is_top_level(cid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.activity_comments c
    where c.id = cid
      and c.parent_id is null
  );
$$;


--
-- Name: connection_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.connection_count(p_profile_id uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*) from public.connections c
  where c.status = 'accepted'
    and (c.requester_id = p_profile_id or c.addressee_id = p_profile_id);
$$;


--
-- Name: connection_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.connection_status(target uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (
      select case
        when c.status = 'accepted'       then 'connected'
        when c.requester_id = auth.uid() then 'pending_outgoing'
        else                                  'pending_incoming'
      end
      from public.connections c
      where c.pair_lo = least(auth.uid(), target)
        and c.pair_hi = greatest(auth.uid(), target)
    ),
    'none'
  );
$$;


--
-- Name: connections_freeze_pair(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.connections_freeze_pair() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.requester_id <> old.requester_id
     or new.addressee_id <> old.addressee_id then
    raise exception 'connections: requester_id and addressee_id are immutable';
  end if;
  return new;
end;
$$;


--
-- Name: content_guard_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.content_guard_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if public.auto_approve_enabled(tg_table_name) then
      new.status := 'published';
    else
      new.status := 'pending';
    end if;
  else
    new.status := old.status;
  end if;
  return new;
end;
$$;


--
-- Name: endorsement_count(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.endorsement_count(p_subject_id uuid, p_skill text) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*) from public.endorsements e
  where e.subject_id = p_subject_id
    and e.skill = p_skill;
$$;


--
-- Name: global_search(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.global_search(q text) RETURNS TABLE(kind text, id uuid, title text, subtitle text, snippet text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: has_applied(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_applied(p_project_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.applications a
    where a.project_id = p_project_id
      and a.applicant_id = auth.uid()
  );
$$;


--
-- Name: has_applied_to_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_applied_to_role(p_role_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.applications a
    where a.role_id = p_role_id
      and a.applicant_id = auth.uid()
  );
$$;


--
-- Name: has_reacted(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_reacted(p_event_id uuid, p_kind text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.activity_reactions r
    where r.event_id = p_event_id
      and r.actor_id = auth.uid()
      and r.kind = p_kind
  );
$$;


--
-- Name: in_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.in_conversation(conv_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = conv_id
      and p.user_id = auth.uid()
  );
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  );
$$;


--
-- Name: is_approved_pro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_approved_pro() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.account_type = 'professional'
      and p.application_status = 'approved'
  );
$$;


--
-- Name: is_enrolled(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_enrolled(p_class_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.class_enrollments e
    where e.class_id = p_class_id
      and e.user_id  = auth.uid()
  );
$$;


--
-- Name: is_following(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_following(target uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.follows f
    where f.follower_id = auth.uid()
      and f.following_id = target
  );
$$;


--
-- Name: is_member(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_member() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        (p.account_type = 'professional' and public.is_approved_pro())
        or p.account_type = 'consumer'
      )
  );
$$;


--
-- Name: mutual_connection_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mutual_connection_count(target uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*) from (
    select case when c.requester_id = auth.uid() then c.addressee_id
                else c.requester_id end
    from public.connections c
    where c.status = 'accepted'
      and (c.requester_id = auth.uid() or c.addressee_id = auth.uid())
    intersect
    select case when c.requester_id = target then c.addressee_id
                else c.requester_id end
    from public.connections c
    where c.status = 'accepted'
      and (c.requester_id = target or c.addressee_id = target)
  ) mutuals;
$$;


--
-- Name: open_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_conversation(p_other uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_me   uuid := auth.uid();
  v_conv uuid;
begin
  if not public.is_approved_pro() then
    raise exception 'Only approved professionals can message.';
  end if;
  if p_other is null then
    raise exception 'Choose someone to message.';
  end if;
  if p_other = v_me then
    raise exception 'You can''t message yourself.';
  end if;
  if not public.profile_is_approved_pro(p_other) then
    raise exception 'You can only message approved professionals.';
  end if;

  insert into public.conversations (user_a, user_b)
  values (least(v_me, p_other), greatest(v_me, p_other))
  on conflict (user_a, user_b) do nothing
  returning id into v_conv;

  if v_conv is not null then
    insert into public.conversation_participants (conversation_id, user_id, accepted)
    values
      (v_conv, v_me, true),
      (v_conv, p_other, exists (
        select 1 from public.follows f
        where f.follower_id = p_other
          and f.following_id = v_me
      ));
  else
    select c.id into v_conv
    from public.conversations c
    where c.user_a = least(v_me, p_other)
      and c.user_b = greatest(v_me, p_other);

    insert into public.conversation_participants (conversation_id, user_id, accepted)
    values (v_conv, v_me, true)
    on conflict (conversation_id, user_id) do update set accepted = true;
  end if;

  return v_conv;
end;
$$;


--
-- Name: platform_settings_stamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.platform_settings_stamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;


--
-- Name: profile_is_approved_pro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profile_is_approved_pro(p_profile_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id
      and p.account_type = 'professional'
      and p.application_status = 'approved'
  );
$$;


--
-- Name: profile_lists_skill(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profile_lists_skill(p_profile_id uuid, p_skill text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id
      and (lower(p.role) = lower(p_skill) or p_skill = any (p.skills))
  );
$$;


--
-- Name: profiles_guard_privileged(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profiles_guard_privileged() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_admin := false;
    if new.account_type = 'professional'
       and public.auto_approve_enabled('pro_applications') then
      new.application_status := 'approved';
    else
      new.application_status := 'pending';
    end if;
  else
    new.is_admin := old.is_admin;
    new.application_status := old.application_status;
    new.account_type := old.account_type;
  end if;
  return new;
end;
$$;


--
-- Name: project_applicant_emails(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_applicant_emails(p_project_id uuid) RETURNS TABLE(applicant_id uuid, email text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select distinct a.applicant_id, u.email::text
  from public.applications a
  join public.projects p on p.id = a.project_id
  join auth.users u on u.id = a.applicant_id
  where a.project_id = p_project_id
    and p.created_by = auth.uid();
$$;


--
-- Name: projects_guard_staff_pick(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.projects_guard_staff_pick() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.staff_pick := false;
  else
    new.staff_pick := old.staff_pick;
  end if;
  return new;
end;
$$;


--
-- Name: reaction_count(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reaction_count(p_event_id uuid, p_kind text) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*) from public.activity_reactions r
  where r.event_id = p_event_id
    and r.kind = p_kind;
$$;


--
-- Name: reset_seed_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_seed_conversation(p_other uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: role_belongs_to_project(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.role_belongs_to_project(p_role_id uuid, p_project_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.project_roles r
    where r.id = p_role_id
      and r.project_id = p_project_id
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    author_id uuid NOT NULL,
    parent_id uuid,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT activity_comments_body_check CHECK (((length(btrim(body)) >= 1) AND (length(btrim(body)) <= 1000)))
);


--
-- Name: activity_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid NOT NULL,
    kind text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    subject_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT activity_events_kind_check CHECK ((kind = ANY (ARRAY['status_update'::text, 'started_following'::text, 'class_enrolled'::text, 'project_booked'::text, 'project_posted'::text])))
);


--
-- Name: activity_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_reactions (
    event_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    kind text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT activity_reactions_kind_check CHECK ((kind = 'congratulate'::text))
);


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    applicant_id uuid NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'submitted'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    role_id uuid
);


--
-- Name: articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    title text NOT NULL,
    category text DEFAULT 'interview'::text NOT NULL,
    excerpt text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT articles_category_check CHECK ((category = ANY (ARRAY['interview'::text, 'craft'::text, 'scene_report'::text, 'news'::text]))),
    CONSTRAINT articles_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'published'::text, 'rejected'::text])))
);


--
-- Name: class_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: class_enrollment_counts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.class_enrollment_counts WITH (security_invoker='false') AS
 SELECT class_id,
    count(*) AS enrolled_count
   FROM public.class_enrollments
  GROUP BY class_id;


--
-- Name: class_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    rating integer NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT class_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

ALTER TABLE ONLY public.class_reviews FORCE ROW LEVEL SECURITY;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    discipline text DEFAULT 'any'::text NOT NULL,
    format text DEFAULT 'in_person'::text NOT NULL,
    venue text DEFAULT ''::text NOT NULL,
    level text DEFAULT 'all'::text NOT NULL,
    price_cents integer DEFAULT 0 NOT NULL,
    capacity integer DEFAULT 12 NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT classes_capacity_check CHECK ((capacity > 0)),
    CONSTRAINT classes_discipline_check CHECK ((discipline = ANY (ARRAY['actor'::text, 'writer'::text, 'director'::text, 'producer'::text, 'cinematographer'::text, 'videographer'::text, 'editor'::text, 'composer'::text, 'sound_designer'::text, 'sound_operator'::text, 'costume_designer'::text, 'makeup_artist'::text, 'any'::text]))),
    CONSTRAINT classes_format_check CHECK ((format = ANY (ARRAY['in_person'::text, 'virtual'::text]))),
    CONSTRAINT classes_level_check CHECK ((level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'all'::text]))),
    CONSTRAINT classes_price_cents_check CHECK ((price_cents >= 0)),
    CONSTRAINT classes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'published'::text, 'rejected'::text])))
);


--
-- Name: connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connections (
    requester_id uuid NOT NULL,
    addressee_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    pair_lo uuid GENERATED ALWAYS AS (LEAST(requester_id, addressee_id)) STORED,
    pair_hi uuid GENERATED ALWAYS AS (GREATEST(requester_id, addressee_id)) STORED,
    CONSTRAINT connections_check CHECK ((requester_id <> addressee_id)),
    CONSTRAINT connections_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text])))
);


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participants (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    accepted boolean DEFAULT false NOT NULL,
    last_read_at timestamp with time zone
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_a uuid NOT NULL,
    user_b uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversations_check CHECK ((user_a <> user_b)),
    CONSTRAINT conversations_check1 CHECK ((user_a < user_b))
);


--
-- Name: endorsements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.endorsements (
    endorser_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    skill text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT endorsements_check CHECK ((endorser_id <> subject_id))
);


--
-- Name: event_rsvps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_rsvps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_rsvp_counts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.event_rsvp_counts WITH (security_invoker='false') AS
 SELECT event_id,
    count(*) AS rsvp_count
   FROM public.event_rsvps
  GROUP BY event_id;


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    venue text DEFAULT ''::text NOT NULL,
    event_type text DEFAULT 'screening'::text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT events_event_type_check CHECK ((event_type = ANY (ARRAY['screening'::text, 'q_and_a'::text, 'panel'::text, 'festival'::text, 'mixer'::text]))),
    CONSTRAINT events_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'published'::text, 'rejected'::text])))
);


--
-- Name: follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follows (
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT follows_check CHECK ((follower_id <> following_id))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_body_check CHECK ((length(TRIM(BOTH FROM body)) > 0))
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    id boolean DEFAULT true NOT NULL,
    auto_approve_pro_applications boolean DEFAULT false NOT NULL,
    auto_approve_classes boolean DEFAULT false NOT NULL,
    auto_approve_events boolean DEFAULT false NOT NULL,
    auto_approve_articles boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT platform_settings_singleton CHECK (id)
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    account_type text,
    application_status text,
    created_at timestamp with time zone DEFAULT now(),
    role text,
    consumer_type text,
    portfolio_files text[],
    display_name text,
    headline text,
    bio text,
    is_admin boolean DEFAULT false NOT NULL,
    skills text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT profiles_account_type_check CHECK ((account_type = ANY (ARRAY['professional'::text, 'consumer'::text]))),
    CONSTRAINT profiles_application_status_check CHECK ((application_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT profiles_consumer_type_check CHECK ((consumer_type = ANY (ARRAY['film_fan'::text, 'cinephile'::text, 'film_student'::text, 'industry_adjacent'::text]))),
    CONSTRAINT profiles_skills_check CHECK ((skills <@ ARRAY['actor'::text, 'writer'::text, 'director'::text, 'producer'::text, 'cinematographer'::text, 'videographer'::text, 'editor'::text, 'composer'::text, 'sound_designer'::text, 'sound_operator'::text, 'costume_designer'::text, 'makeup_artist'::text]))
);


--
-- Name: project_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    billing text DEFAULT 'supporting'::text NOT NULL,
    gender text DEFAULT 'any'::text NOT NULL,
    age_min integer,
    age_max integer,
    description text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_roles_billing_check CHECK ((billing = ANY (ARRAY['lead'::text, 'supporting'::text, 'background'::text, 'crew'::text]))),
    CONSTRAINT project_roles_check CHECK (((age_min IS NULL) OR (age_max IS NULL) OR (age_min <= age_max))),
    CONSTRAINT project_roles_gender_check CHECK ((gender = ANY (ARRAY['any'::text, 'female'::text, 'male'::text, 'non-binary'::text]))),
    CONSTRAINT project_roles_status_check CHECK ((status = ANY (ARRAY['open'::text, 'filled'::text])))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    title text NOT NULL,
    discipline text DEFAULT 'any'::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    compensation text DEFAULT 'unpaid'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    disciplines text[] DEFAULT '{}'::text[] NOT NULL,
    project_type text DEFAULT 'other'::text NOT NULL,
    pay_min integer,
    pay_max integer,
    pay_unit text DEFAULT 'day'::text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    staff_pick boolean DEFAULT false NOT NULL,
    posted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT projects_compensation_check CHECK ((compensation = ANY (ARRAY['paid'::text, 'unpaid'::text, 'deferred'::text]))),
    CONSTRAINT projects_disciplines_check CHECK (((disciplines <> '{}'::text[]) AND (disciplines <@ ARRAY['actor'::text, 'writer'::text, 'director'::text, 'producer'::text, 'cinematographer'::text, 'videographer'::text, 'editor'::text, 'composer'::text, 'sound_designer'::text, 'sound_operator'::text, 'costume_designer'::text, 'makeup_artist'::text, 'any'::text]))),
    CONSTRAINT projects_pay_range_check CHECK (((pay_min IS NULL) OR (pay_max IS NULL) OR (pay_min <= pay_max))),
    CONSTRAINT projects_pay_unit_check CHECK (((pay_unit IS NULL) OR (pay_unit = ANY (ARRAY['hour'::text, 'day'::text, 'week'::text, 'project'::text])))),
    CONSTRAINT projects_project_type_check CHECK ((project_type = ANY (ARRAY['short_film'::text, 'feature_film'::text, 'web_series'::text, 'music_video'::text, 'commercial'::text, 'documentary'::text, 'crew_call'::text, 'other'::text]))),
    CONSTRAINT projects_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


--
-- Name: public_profiles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_profiles AS
 SELECT id,
    display_name,
    role,
    headline,
    bio,
    portfolio_files,
    skills
   FROM public.profiles
  WHERE ((account_type = 'professional'::text) AND (application_status = 'approved'::text));


--
-- Name: saved_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    item_type text NOT NULL,
    item_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT saved_items_item_type_check CHECK ((item_type = ANY (ARRAY['event'::text, 'article'::text, 'project'::text])))
);


--
-- Name: work_samples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_samples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    storage_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_comments activity_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_comments
    ADD CONSTRAINT activity_comments_pkey PRIMARY KEY (id);


--
-- Name: activity_events activity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_pkey PRIMARY KEY (id);


--
-- Name: activity_reactions activity_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_reactions
    ADD CONSTRAINT activity_reactions_pkey PRIMARY KEY (event_id, actor_id, kind);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: class_enrollments class_enrollments_class_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT class_enrollments_class_id_user_id_key UNIQUE (class_id, user_id);


--
-- Name: class_enrollments class_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT class_enrollments_pkey PRIMARY KEY (id);


--
-- Name: class_reviews class_reviews_class_id_reviewer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_reviews
    ADD CONSTRAINT class_reviews_class_id_reviewer_id_key UNIQUE (class_id, reviewer_id);


--
-- Name: class_reviews class_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_reviews
    ADD CONSTRAINT class_reviews_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: connections connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_pkey PRIMARY KEY (requester_id, addressee_id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_user_a_user_b_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_a_user_b_key UNIQUE (user_a, user_b);


--
-- Name: endorsements endorsements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endorsements
    ADD CONSTRAINT endorsements_pkey PRIMARY KEY (endorser_id, subject_id, skill);


--
-- Name: event_rsvps event_rsvps_event_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_rsvps
    ADD CONSTRAINT event_rsvps_event_id_user_id_key UNIQUE (event_id, user_id);


--
-- Name: event_rsvps event_rsvps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_rsvps
    ADD CONSTRAINT event_rsvps_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_roles project_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_roles
    ADD CONSTRAINT project_roles_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: saved_items saved_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_items
    ADD CONSTRAINT saved_items_pkey PRIMARY KEY (id);


--
-- Name: saved_items saved_items_user_id_item_type_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_items
    ADD CONSTRAINT saved_items_user_id_item_type_item_id_key UNIQUE (user_id, item_type, item_id);


--
-- Name: work_samples work_samples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_samples
    ADD CONSTRAINT work_samples_pkey PRIMARY KEY (id);


--
-- Name: activity_comments_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_comments_event_id_idx ON public.activity_comments USING btree (event_id);


--
-- Name: activity_comments_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_comments_parent_id_idx ON public.activity_comments USING btree (parent_id);


--
-- Name: activity_events_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_events_actor_id_idx ON public.activity_events USING btree (actor_id);


--
-- Name: activity_events_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_events_created_at_idx ON public.activity_events USING btree (created_at DESC);


--
-- Name: applications_applicant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_applicant_id_idx ON public.applications USING btree (applicant_id);


--
-- Name: applications_project_applicant_whole_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX applications_project_applicant_whole_uniq ON public.applications USING btree (project_id, applicant_id) WHERE (role_id IS NULL);


--
-- Name: applications_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_project_id_idx ON public.applications USING btree (project_id);


--
-- Name: applications_role_applicant_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX applications_role_applicant_uniq ON public.applications USING btree (role_id, applicant_id) WHERE (role_id IS NOT NULL);


--
-- Name: articles_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX articles_created_at_idx ON public.articles USING btree (created_at DESC);


--
-- Name: articles_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX articles_status_idx ON public.articles USING btree (status);


--
-- Name: class_enrollments_class_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX class_enrollments_class_id_idx ON public.class_enrollments USING btree (class_id);


--
-- Name: class_enrollments_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX class_enrollments_user_id_idx ON public.class_enrollments USING btree (user_id);


--
-- Name: class_reviews_class_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX class_reviews_class_id_idx ON public.class_reviews USING btree (class_id);


--
-- Name: classes_starts_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classes_starts_at_idx ON public.classes USING btree (starts_at);


--
-- Name: classes_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classes_status_idx ON public.classes USING btree (status);


--
-- Name: connections_addressee_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX connections_addressee_status_idx ON public.connections USING btree (addressee_id, status);


--
-- Name: connections_pair_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX connections_pair_uniq ON public.connections USING btree (pair_lo, pair_hi);


--
-- Name: conversation_participants_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_participants_user_id_idx ON public.conversation_participants USING btree (user_id);


--
-- Name: endorsements_subject_skill_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX endorsements_subject_skill_idx ON public.endorsements USING btree (subject_id, skill);


--
-- Name: event_rsvps_event_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_rsvps_event_id_idx ON public.event_rsvps USING btree (event_id);


--
-- Name: event_rsvps_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_rsvps_user_id_idx ON public.event_rsvps USING btree (user_id);


--
-- Name: events_starts_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_starts_at_idx ON public.events USING btree (starts_at);


--
-- Name: events_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_status_idx ON public.events USING btree (status);


--
-- Name: follows_follower_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX follows_follower_id_idx ON public.follows USING btree (follower_id);


--
-- Name: follows_following_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX follows_following_id_idx ON public.follows USING btree (following_id);


--
-- Name: messages_conversation_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_created_idx ON public.messages USING btree (conversation_id, created_at);


--
-- Name: project_roles_project_id_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_roles_project_id_sort_order_idx ON public.project_roles USING btree (project_id, sort_order);


--
-- Name: projects_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_created_by_idx ON public.projects USING btree (created_by);


--
-- Name: projects_posted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_posted_at_idx ON public.projects USING btree (posted_at DESC);


--
-- Name: projects_project_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_project_type_idx ON public.projects USING btree (project_type);


--
-- Name: projects_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_status_idx ON public.projects USING btree (status);


--
-- Name: saved_items_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX saved_items_user_id_created_at_idx ON public.saved_items USING btree (user_id, created_at DESC);


--
-- Name: work_samples_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_samples_profile_id_idx ON public.work_samples USING btree (profile_id);


--
-- Name: applications applications_check_role_project; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER applications_check_role_project BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.applications_check_role_project();


--
-- Name: articles articles_guard_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER articles_guard_status BEFORE INSERT OR UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.content_guard_status();


--
-- Name: classes classes_guard_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classes_guard_status BEFORE INSERT OR UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.content_guard_status();


--
-- Name: connections connections_freeze_pair; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER connections_freeze_pair BEFORE UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.connections_freeze_pair();


--
-- Name: events events_guard_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER events_guard_status BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.content_guard_status();


--
-- Name: platform_settings platform_settings_stamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER platform_settings_stamp BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.platform_settings_stamp();


--
-- Name: profiles profiles_guard_privileged; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_guard_privileged BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged();


--
-- Name: projects projects_guard_staff_pick; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER projects_guard_staff_pick BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.projects_guard_staff_pick();


--
-- Name: activity_comments activity_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_comments
    ADD CONSTRAINT activity_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: activity_comments activity_comments_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_comments
    ADD CONSTRAINT activity_comments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.activity_events(id) ON DELETE CASCADE;


--
-- Name: activity_comments activity_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_comments
    ADD CONSTRAINT activity_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.activity_comments(id) ON DELETE CASCADE;


--
-- Name: activity_events activity_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_events
    ADD CONSTRAINT activity_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: activity_reactions activity_reactions_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_reactions
    ADD CONSTRAINT activity_reactions_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: activity_reactions activity_reactions_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_reactions
    ADD CONSTRAINT activity_reactions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.activity_events(id) ON DELETE CASCADE;


--
-- Name: applications applications_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: applications applications_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: applications applications_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.project_roles(id) ON DELETE CASCADE;


--
-- Name: articles articles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: class_enrollments class_enrollments_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT class_enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: class_enrollments class_enrollments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT class_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: class_reviews class_reviews_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_reviews
    ADD CONSTRAINT class_reviews_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: class_reviews class_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_reviews
    ADD CONSTRAINT class_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: classes classes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: connections connections_addressee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: connections connections_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_user_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_a_fkey FOREIGN KEY (user_a) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_user_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_b_fkey FOREIGN KEY (user_b) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: endorsements endorsements_endorser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endorsements
    ADD CONSTRAINT endorsements_endorser_id_fkey FOREIGN KEY (endorser_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: endorsements endorsements_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.endorsements
    ADD CONSTRAINT endorsements_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: event_rsvps event_rsvps_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_rsvps
    ADD CONSTRAINT event_rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_rsvps event_rsvps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_rsvps
    ADD CONSTRAINT event_rsvps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: follows follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: platform_settings platform_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_roles project_roles_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_roles
    ADD CONSTRAINT project_roles_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: saved_items saved_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_items
    ADD CONSTRAINT saved_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: work_samples work_samples_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_samples
    ADD CONSTRAINT work_samples_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: activity_reactions Actors delete own reactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Actors delete own reactions" ON public.activity_reactions FOR DELETE USING ((actor_id = auth.uid()));


--
-- Name: connections Addressees accept pending requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Addressees accept pending requests" ON public.connections FOR UPDATE USING (((addressee_id = auth.uid()) AND (status = 'pending'::text))) WITH CHECK (((addressee_id = auth.uid()) AND (status = 'accepted'::text) AND (responded_at IS NOT NULL)));


--
-- Name: profiles Admins can update profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: projects Admins can update projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update projects" ON public.projects FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());


--
-- Name: projects Admins can view all projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all projects" ON public.projects FOR SELECT USING (public.is_admin());


--
-- Name: articles Admins read all articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read all articles" ON public.articles FOR SELECT USING (public.is_admin());


--
-- Name: classes Admins read all classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read all classes" ON public.classes FOR SELECT USING (public.is_admin());


--
-- Name: events Admins read all events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read all events" ON public.events FOR SELECT USING (public.is_admin());


--
-- Name: platform_settings Admins read platform settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read platform settings" ON public.platform_settings FOR SELECT USING (public.is_admin());


--
-- Name: articles Admins update articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update articles" ON public.articles FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: classes Admins update classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update classes" ON public.classes FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: events Admins update events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update events" ON public.events FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: platform_settings Admins update platform settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins update platform settings" ON public.platform_settings FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: articles Anyone reads published articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone reads published articles" ON public.articles FOR SELECT TO authenticated, anon USING ((status = 'published'::text));


--
-- Name: classes Anyone reads published classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone reads published classes" ON public.classes FOR SELECT TO authenticated, anon USING ((status = 'published'::text));


--
-- Name: events Anyone reads published events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone reads published events" ON public.events FOR SELECT TO authenticated, anon USING ((status = 'published'::text));


--
-- Name: profiles Approved members can view profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved members can view profiles" ON public.profiles FOR SELECT USING ((public.is_approved_pro() AND ((account_type = 'consumer'::text) OR ((account_type = 'professional'::text) AND (application_status = 'approved'::text)))));


--
-- Name: applications Approved members create applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved members create applications" ON public.applications FOR INSERT WITH CHECK (((applicant_id = auth.uid()) AND public.is_approved_pro() AND (EXISTS ( SELECT 1
   FROM public.projects pr
  WHERE ((pr.id = applications.project_id) AND (pr.status = 'open'::text) AND (pr.created_by <> auth.uid()))))));


--
-- Name: articles Approved members create own articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved members create own articles" ON public.articles FOR INSERT WITH CHECK (((created_by = auth.uid()) AND public.is_approved_pro()));


--
-- Name: classes Approved members create own classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved members create own classes" ON public.classes FOR INSERT WITH CHECK (((created_by = auth.uid()) AND public.is_approved_pro()));


--
-- Name: events Approved members create own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved members create own events" ON public.events FOR INSERT WITH CHECK (((created_by = auth.uid()) AND public.is_approved_pro()));


--
-- Name: projects Approved members create own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved members create own projects" ON public.projects FOR INSERT WITH CHECK (((created_by = auth.uid()) AND public.is_approved_pro()));


--
-- Name: activity_events Approved members post activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved members post activity" ON public.activity_events FOR INSERT WITH CHECK (((actor_id = auth.uid()) AND public.is_approved_pro() AND (kind = ANY (ARRAY['status_update'::text, 'started_following'::text]))));


--
-- Name: projects Approved members read open projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved members read open projects" ON public.projects FOR SELECT USING ((((status = 'open'::text) AND public.is_approved_pro()) OR (created_by = auth.uid()) OR public.has_applied(id)));


--
-- Name: work_samples Approved pros add own work samples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved pros add own work samples" ON public.work_samples FOR INSERT WITH CHECK (((profile_id = auth.uid()) AND public.is_approved_pro()));


--
-- Name: endorsements Approved pros endorse listed skills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved pros endorse listed skills" ON public.endorsements FOR INSERT WITH CHECK (((endorser_id = auth.uid()) AND public.is_approved_pro() AND public.profile_is_approved_pro(subject_id) AND public.profile_lists_skill(subject_id, skill)));


--
-- Name: class_enrollments Approved pros enroll in published classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved pros enroll in published classes" ON public.class_enrollments FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND public.is_approved_pro() AND (EXISTS ( SELECT 1
   FROM public.classes c
  WHERE ((c.id = class_enrollments.class_id) AND (c.status = 'published'::text) AND (c.created_by <> auth.uid()) AND (public.class_seats_taken(c.id) < c.capacity))))));


--
-- Name: connections Approved pros request connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved pros request connections" ON public.connections FOR INSERT WITH CHECK (((requester_id = auth.uid()) AND (status = 'pending'::text) AND public.is_approved_pro() AND public.profile_is_approved_pro(addressee_id)));


--
-- Name: articles Authors read own articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors read own articles" ON public.articles FOR SELECT USING ((created_by = auth.uid()));


--
-- Name: classes Authors read own classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors read own classes" ON public.classes FOR SELECT USING ((created_by = auth.uid()));


--
-- Name: events Authors read own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors read own events" ON public.events FOR SELECT USING ((created_by = auth.uid()));


--
-- Name: articles Authors update own articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors update own articles" ON public.articles FOR UPDATE USING ((created_by = auth.uid())) WITH CHECK ((created_by = auth.uid()));


--
-- Name: classes Authors update own classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors update own classes" ON public.classes FOR UPDATE USING ((created_by = auth.uid())) WITH CHECK ((created_by = auth.uid()));


--
-- Name: events Authors update own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authors update own events" ON public.events FOR UPDATE USING ((created_by = auth.uid())) WITH CHECK ((created_by = auth.uid()));


--
-- Name: activity_comments Comment on visible events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Comment on visible events" ON public.activity_comments FOR INSERT WITH CHECK (((author_id = auth.uid()) AND public.can_view_event(event_id) AND ((parent_id IS NULL) OR public.comment_is_top_level(parent_id))));


--
-- Name: conversation_participants Delete own participant row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Delete own participant row" ON public.conversation_participants FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: activity_comments Delete your own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Delete your own comments" ON public.activity_comments FOR DELETE USING ((author_id = auth.uid()));


--
-- Name: endorsements Endorsers delete own endorsements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Endorsers delete own endorsements" ON public.endorsements FOR DELETE USING ((endorser_id = auth.uid()));


--
-- Name: class_reviews Enrolled pros review their class; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enrolled pros review their class" ON public.class_reviews FOR INSERT TO authenticated WITH CHECK (((reviewer_id = auth.uid()) AND public.is_approved_pro() AND public.is_enrolled(class_id)));


--
-- Name: class_enrollments Instructors read enrollments in their classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Instructors read enrollments in their classes" ON public.class_enrollments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.classes c
  WHERE ((c.id = class_enrollments.class_id) AND (c.created_by = auth.uid())))));


--
-- Name: follows Members follow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members follow" ON public.follows FOR INSERT WITH CHECK (((follower_id = auth.uid()) AND public.is_member()));


--
-- Name: activity_reactions Members react to visible events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members react to visible events" ON public.activity_reactions FOR INSERT WITH CHECK (((actor_id = auth.uid()) AND public.is_member() AND public.can_view_event(event_id)));


--
-- Name: endorsements Members read endorsements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members read endorsements" ON public.endorsements FOR SELECT USING (public.is_member());


--
-- Name: project_roles Owners create roles on own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners create roles on own projects" ON public.project_roles FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_roles.project_id) AND (p.created_by = auth.uid())))));


--
-- Name: work_samples Owners delete own work sample rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners delete own work sample rows" ON public.work_samples FOR DELETE USING ((profile_id = auth.uid()));


--
-- Name: project_roles Owners delete roles on own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners delete roles on own projects" ON public.project_roles FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_roles.project_id) AND (p.created_by = auth.uid())))));


--
-- Name: projects Owners update own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners update own projects" ON public.projects FOR UPDATE USING ((created_by = auth.uid())) WITH CHECK ((created_by = auth.uid()));


--
-- Name: project_roles Owners update roles on own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners update roles on own projects" ON public.project_roles FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_roles.project_id) AND (p.created_by = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_roles.project_id) AND (p.created_by = auth.uid())))));


--
-- Name: connections Parties delete own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Parties delete own connections" ON public.connections FOR DELETE USING (((requester_id = auth.uid()) OR (addressee_id = auth.uid())));


--
-- Name: connections Parties read own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Parties read own connections" ON public.connections FOR SELECT USING (((requester_id = auth.uid()) OR (addressee_id = auth.uid())));


--
-- Name: activity_comments Read comments on visible events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read comments on visible events" ON public.activity_comments FOR SELECT USING (public.can_view_event(event_id));


--
-- Name: follows Read follows you are part of; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read follows you are part of" ON public.follows FOR SELECT USING (((follower_id = auth.uid()) OR (following_id = auth.uid())));


--
-- Name: messages Read messages in own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read messages in own conversations" ON public.messages FOR SELECT TO authenticated USING (public.in_conversation(conversation_id));


--
-- Name: conversations Read own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read own conversations" ON public.conversations FOR SELECT TO authenticated USING (((user_a = auth.uid()) OR (user_b = auth.uid())));


--
-- Name: applications Read own or owned applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read own or owned applications" ON public.applications FOR SELECT USING (((applicant_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.projects pr
  WHERE ((pr.id = applications.project_id) AND (pr.created_by = auth.uid()))))));


--
-- Name: conversation_participants Read participants of own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read participants of own conversations" ON public.conversation_participants FOR SELECT TO authenticated USING (public.in_conversation(conversation_id));


--
-- Name: activity_reactions Read reactions on visible events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read reactions on visible events" ON public.activity_reactions FOR SELECT USING (public.can_view_event(event_id));


--
-- Name: project_roles Read roles of visible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read roles of visible projects" ON public.project_roles FOR SELECT USING (public.can_view_project(project_id));


--
-- Name: activity_events Read self and followed activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Read self and followed activity" ON public.activity_events FOR SELECT USING (((actor_id = auth.uid()) OR public.is_following(actor_id)));


--
-- Name: class_reviews Reviewers and admins delete reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviewers and admins delete reviews" ON public.class_reviews FOR DELETE TO authenticated USING (((reviewer_id = auth.uid()) OR public.is_admin()));


--
-- Name: class_reviews Reviewers update own review; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviewers update own review" ON public.class_reviews FOR UPDATE TO authenticated USING ((reviewer_id = auth.uid())) WITH CHECK ((reviewer_id = auth.uid()));


--
-- Name: class_reviews Reviews on published classes are readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviews on published classes are readable" ON public.class_reviews FOR SELECT TO authenticated USING (((reviewer_id = auth.uid()) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.classes c
  WHERE ((c.id = class_reviews.class_id) AND (c.status = 'published'::text))))));


--
-- Name: messages Send into own un-ignored conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Send into own un-ignored conversations" ON public.messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND public.is_approved_pro() AND public.in_conversation(conversation_id) AND (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND (EXISTS ( SELECT 1
           FROM public.conversation_participants p
          WHERE ((p.conversation_id = c.id) AND (p.user_id <> auth.uid())))))))));


--
-- Name: work_samples Signed-in users read work samples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Signed-in users read work samples" ON public.work_samples FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: follows Unfollow your own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Unfollow your own" ON public.follows FOR DELETE USING ((follower_id = auth.uid()));


--
-- Name: conversation_participants Update own participant row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update own participant row" ON public.conversation_participants FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (((auth.uid())::text = (id)::text));


--
-- Name: profiles Users can read their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (((auth.uid())::text = (id)::text));


--
-- Name: class_enrollments Users delete own enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own enrollments" ON public.class_enrollments FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: event_rsvps Users delete own rsvps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own rsvps" ON public.event_rsvps FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: saved_items Users delete own saves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own saves" ON public.saved_items FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: class_enrollments Users read own enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own enrollments" ON public.class_enrollments FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: event_rsvps Users read own rsvps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own rsvps" ON public.event_rsvps FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: saved_items Users read own saves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own saves" ON public.saved_items FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: event_rsvps Users rsvp to published events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users rsvp to published events" ON public.event_rsvps FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = event_rsvps.event_id) AND (e.status = 'published'::text))))));


--
-- Name: saved_items Users save published items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users save published items" ON public.saved_items FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (((item_type = 'event'::text) AND (EXISTS ( SELECT 1
   FROM public.events e
  WHERE ((e.id = saved_items.item_id) AND (e.status = 'published'::text))))) OR ((item_type = 'article'::text) AND (EXISTS ( SELECT 1
   FROM public.articles a
  WHERE ((a.id = saved_items.item_id) AND (a.status = 'published'::text))))) OR ((item_type = 'project'::text) AND public.can_view_project(item_id)))));


--
-- Name: activity_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

--
-- Name: class_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: class_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: endorsements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.endorsements ENABLE ROW LEVEL SECURITY;

--
-- Name: event_rsvps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: follows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

--
-- Name: work_samples; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_samples ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION admin_profile_emails(p_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_profile_emails(p_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_profile_emails(p_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_profile_emails(p_ids uuid[]) TO service_role;


--
-- Name: FUNCTION applications_check_role_project(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.applications_check_role_project() TO anon;
GRANT ALL ON FUNCTION public.applications_check_role_project() TO authenticated;
GRANT ALL ON FUNCTION public.applications_check_role_project() TO service_role;


--
-- Name: FUNCTION are_connected(target uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.are_connected(target uuid) TO anon;
GRANT ALL ON FUNCTION public.are_connected(target uuid) TO authenticated;
GRANT ALL ON FUNCTION public.are_connected(target uuid) TO service_role;


--
-- Name: FUNCTION auto_approve_enabled(kind text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auto_approve_enabled(kind text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.auto_approve_enabled(kind text) TO authenticated;
GRANT ALL ON FUNCTION public.auto_approve_enabled(kind text) TO service_role;


--
-- Name: FUNCTION can_view_event(eid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_view_event(eid uuid) TO anon;
GRANT ALL ON FUNCTION public.can_view_event(eid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_view_event(eid uuid) TO service_role;


--
-- Name: FUNCTION can_view_project(p_project_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_view_project(p_project_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_view_project(p_project_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_view_project(p_project_id uuid) TO service_role;


--
-- Name: FUNCTION circle_applied_count(p_project_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.circle_applied_count(p_project_id uuid) TO anon;
GRANT ALL ON FUNCTION public.circle_applied_count(p_project_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.circle_applied_count(p_project_id uuid) TO service_role;


--
-- Name: FUNCTION circle_applied_counts(p_project_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.circle_applied_counts(p_project_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.circle_applied_counts(p_project_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.circle_applied_counts(p_project_ids uuid[]) TO service_role;


--
-- Name: FUNCTION circle_enrolled_count(p_class_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.circle_enrolled_count(p_class_id uuid) TO anon;
GRANT ALL ON FUNCTION public.circle_enrolled_count(p_class_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.circle_enrolled_count(p_class_id uuid) TO service_role;


--
-- Name: FUNCTION class_seats_taken(p_class_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.class_seats_taken(p_class_id uuid) TO anon;
GRANT ALL ON FUNCTION public.class_seats_taken(p_class_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.class_seats_taken(p_class_id uuid) TO service_role;


--
-- Name: FUNCTION comment_is_top_level(cid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.comment_is_top_level(cid uuid) TO anon;
GRANT ALL ON FUNCTION public.comment_is_top_level(cid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.comment_is_top_level(cid uuid) TO service_role;


--
-- Name: FUNCTION connection_count(p_profile_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.connection_count(p_profile_id uuid) TO anon;
GRANT ALL ON FUNCTION public.connection_count(p_profile_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.connection_count(p_profile_id uuid) TO service_role;


--
-- Name: FUNCTION connection_status(target uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.connection_status(target uuid) TO anon;
GRANT ALL ON FUNCTION public.connection_status(target uuid) TO authenticated;
GRANT ALL ON FUNCTION public.connection_status(target uuid) TO service_role;


--
-- Name: FUNCTION connections_freeze_pair(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.connections_freeze_pair() TO anon;
GRANT ALL ON FUNCTION public.connections_freeze_pair() TO authenticated;
GRANT ALL ON FUNCTION public.connections_freeze_pair() TO service_role;


--
-- Name: FUNCTION content_guard_status(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.content_guard_status() TO anon;
GRANT ALL ON FUNCTION public.content_guard_status() TO authenticated;
GRANT ALL ON FUNCTION public.content_guard_status() TO service_role;


--
-- Name: FUNCTION endorsement_count(p_subject_id uuid, p_skill text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.endorsement_count(p_subject_id uuid, p_skill text) TO anon;
GRANT ALL ON FUNCTION public.endorsement_count(p_subject_id uuid, p_skill text) TO authenticated;
GRANT ALL ON FUNCTION public.endorsement_count(p_subject_id uuid, p_skill text) TO service_role;


--
-- Name: FUNCTION global_search(q text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.global_search(q text) TO anon;
GRANT ALL ON FUNCTION public.global_search(q text) TO authenticated;
GRANT ALL ON FUNCTION public.global_search(q text) TO service_role;


--
-- Name: FUNCTION has_applied(p_project_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_applied(p_project_id uuid) TO anon;
GRANT ALL ON FUNCTION public.has_applied(p_project_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_applied(p_project_id uuid) TO service_role;


--
-- Name: FUNCTION has_applied_to_role(p_role_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_applied_to_role(p_role_id uuid) TO anon;
GRANT ALL ON FUNCTION public.has_applied_to_role(p_role_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_applied_to_role(p_role_id uuid) TO service_role;


--
-- Name: FUNCTION has_reacted(p_event_id uuid, p_kind text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_reacted(p_event_id uuid, p_kind text) TO anon;
GRANT ALL ON FUNCTION public.has_reacted(p_event_id uuid, p_kind text) TO authenticated;
GRANT ALL ON FUNCTION public.has_reacted(p_event_id uuid, p_kind text) TO service_role;


--
-- Name: FUNCTION in_conversation(conv_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.in_conversation(conv_id uuid) TO anon;
GRANT ALL ON FUNCTION public.in_conversation(conv_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.in_conversation(conv_id uuid) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_approved_pro(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_approved_pro() TO anon;
GRANT ALL ON FUNCTION public.is_approved_pro() TO authenticated;
GRANT ALL ON FUNCTION public.is_approved_pro() TO service_role;


--
-- Name: FUNCTION is_enrolled(p_class_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_enrolled(p_class_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_enrolled(p_class_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_enrolled(p_class_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_enrolled(p_class_id uuid) TO service_role;


--
-- Name: FUNCTION is_following(target uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_following(target uuid) TO anon;
GRANT ALL ON FUNCTION public.is_following(target uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_following(target uuid) TO service_role;


--
-- Name: FUNCTION is_member(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_member() TO anon;
GRANT ALL ON FUNCTION public.is_member() TO authenticated;
GRANT ALL ON FUNCTION public.is_member() TO service_role;


--
-- Name: FUNCTION mutual_connection_count(target uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mutual_connection_count(target uuid) TO anon;
GRANT ALL ON FUNCTION public.mutual_connection_count(target uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mutual_connection_count(target uuid) TO service_role;


--
-- Name: FUNCTION open_conversation(p_other uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.open_conversation(p_other uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.open_conversation(p_other uuid) TO authenticated;
GRANT ALL ON FUNCTION public.open_conversation(p_other uuid) TO service_role;


--
-- Name: FUNCTION platform_settings_stamp(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.platform_settings_stamp() TO anon;
GRANT ALL ON FUNCTION public.platform_settings_stamp() TO authenticated;
GRANT ALL ON FUNCTION public.platform_settings_stamp() TO service_role;


--
-- Name: FUNCTION profile_is_approved_pro(p_profile_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.profile_is_approved_pro(p_profile_id uuid) TO anon;
GRANT ALL ON FUNCTION public.profile_is_approved_pro(p_profile_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.profile_is_approved_pro(p_profile_id uuid) TO service_role;


--
-- Name: FUNCTION profile_lists_skill(p_profile_id uuid, p_skill text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.profile_lists_skill(p_profile_id uuid, p_skill text) TO anon;
GRANT ALL ON FUNCTION public.profile_lists_skill(p_profile_id uuid, p_skill text) TO authenticated;
GRANT ALL ON FUNCTION public.profile_lists_skill(p_profile_id uuid, p_skill text) TO service_role;


--
-- Name: FUNCTION profiles_guard_privileged(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.profiles_guard_privileged() TO anon;
GRANT ALL ON FUNCTION public.profiles_guard_privileged() TO authenticated;
GRANT ALL ON FUNCTION public.profiles_guard_privileged() TO service_role;


--
-- Name: FUNCTION project_applicant_emails(p_project_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.project_applicant_emails(p_project_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.project_applicant_emails(p_project_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.project_applicant_emails(p_project_id uuid) TO service_role;


--
-- Name: FUNCTION projects_guard_staff_pick(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.projects_guard_staff_pick() TO anon;
GRANT ALL ON FUNCTION public.projects_guard_staff_pick() TO authenticated;
GRANT ALL ON FUNCTION public.projects_guard_staff_pick() TO service_role;


--
-- Name: FUNCTION reaction_count(p_event_id uuid, p_kind text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reaction_count(p_event_id uuid, p_kind text) TO anon;
GRANT ALL ON FUNCTION public.reaction_count(p_event_id uuid, p_kind text) TO authenticated;
GRANT ALL ON FUNCTION public.reaction_count(p_event_id uuid, p_kind text) TO service_role;


--
-- Name: FUNCTION reset_seed_conversation(p_other uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reset_seed_conversation(p_other uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reset_seed_conversation(p_other uuid) TO authenticated;
GRANT ALL ON FUNCTION public.reset_seed_conversation(p_other uuid) TO service_role;


--
-- Name: FUNCTION role_belongs_to_project(p_role_id uuid, p_project_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.role_belongs_to_project(p_role_id uuid, p_project_id uuid) TO anon;
GRANT ALL ON FUNCTION public.role_belongs_to_project(p_role_id uuid, p_project_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.role_belongs_to_project(p_role_id uuid, p_project_id uuid) TO service_role;


--
-- Name: TABLE activity_comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.activity_comments TO anon;
GRANT ALL ON TABLE public.activity_comments TO authenticated;
GRANT ALL ON TABLE public.activity_comments TO service_role;


--
-- Name: TABLE activity_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.activity_events TO anon;
GRANT ALL ON TABLE public.activity_events TO authenticated;
GRANT ALL ON TABLE public.activity_events TO service_role;


--
-- Name: TABLE activity_reactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.activity_reactions TO anon;
GRANT ALL ON TABLE public.activity_reactions TO authenticated;
GRANT ALL ON TABLE public.activity_reactions TO service_role;


--
-- Name: TABLE applications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.applications TO anon;
GRANT ALL ON TABLE public.applications TO authenticated;
GRANT ALL ON TABLE public.applications TO service_role;


--
-- Name: TABLE articles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.articles TO anon;
GRANT ALL ON TABLE public.articles TO authenticated;
GRANT ALL ON TABLE public.articles TO service_role;


--
-- Name: TABLE class_enrollments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.class_enrollments TO anon;
GRANT ALL ON TABLE public.class_enrollments TO authenticated;
GRANT ALL ON TABLE public.class_enrollments TO service_role;


--
-- Name: TABLE class_enrollment_counts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.class_enrollment_counts TO anon;
GRANT ALL ON TABLE public.class_enrollment_counts TO authenticated;
GRANT ALL ON TABLE public.class_enrollment_counts TO service_role;


--
-- Name: TABLE class_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.class_reviews TO anon;
GRANT ALL ON TABLE public.class_reviews TO authenticated;
GRANT ALL ON TABLE public.class_reviews TO service_role;


--
-- Name: TABLE classes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.classes TO anon;
GRANT ALL ON TABLE public.classes TO authenticated;
GRANT ALL ON TABLE public.classes TO service_role;


--
-- Name: TABLE connections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.connections TO anon;
GRANT ALL ON TABLE public.connections TO authenticated;
GRANT ALL ON TABLE public.connections TO service_role;


--
-- Name: TABLE conversation_participants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.conversation_participants TO anon;
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.conversation_participants TO authenticated;
GRANT ALL ON TABLE public.conversation_participants TO service_role;


--
-- Name: COLUMN conversation_participants.accepted; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(accepted) ON TABLE public.conversation_participants TO authenticated;


--
-- Name: COLUMN conversation_participants.last_read_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(last_read_at) ON TABLE public.conversation_participants TO authenticated;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.conversations TO anon;
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- Name: TABLE endorsements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.endorsements TO anon;
GRANT ALL ON TABLE public.endorsements TO authenticated;
GRANT ALL ON TABLE public.endorsements TO service_role;


--
-- Name: TABLE event_rsvps; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.event_rsvps TO anon;
GRANT ALL ON TABLE public.event_rsvps TO authenticated;
GRANT ALL ON TABLE public.event_rsvps TO service_role;


--
-- Name: TABLE event_rsvp_counts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.event_rsvp_counts TO anon;
GRANT ALL ON TABLE public.event_rsvp_counts TO authenticated;
GRANT ALL ON TABLE public.event_rsvp_counts TO service_role;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;


--
-- Name: TABLE follows; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.follows TO anon;
GRANT ALL ON TABLE public.follows TO authenticated;
GRANT ALL ON TABLE public.follows TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: TABLE platform_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_settings TO anon;
GRANT ALL ON TABLE public.platform_settings TO authenticated;
GRANT ALL ON TABLE public.platform_settings TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.profiles TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.profiles TO anon;
GRANT SELECT(id) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.account_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(account_type) ON TABLE public.profiles TO anon;
GRANT SELECT(account_type) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.application_status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(application_status) ON TABLE public.profiles TO anon;
GRANT SELECT(application_status) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.profiles TO anon;
GRANT SELECT(created_at) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.role; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(role) ON TABLE public.profiles TO anon;
GRANT SELECT(role) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.consumer_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(consumer_type) ON TABLE public.profiles TO anon;
GRANT SELECT(consumer_type) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.portfolio_files; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(portfolio_files) ON TABLE public.profiles TO anon;
GRANT SELECT(portfolio_files) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.display_name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(display_name) ON TABLE public.profiles TO anon;
GRANT SELECT(display_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.headline; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(headline) ON TABLE public.profiles TO anon;
GRANT SELECT(headline) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.bio; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(bio) ON TABLE public.profiles TO anon;
GRANT SELECT(bio) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.is_admin; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(is_admin) ON TABLE public.profiles TO anon;
GRANT SELECT(is_admin) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.skills; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(skills) ON TABLE public.profiles TO anon;
GRANT SELECT(skills) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE project_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.project_roles TO anon;
GRANT ALL ON TABLE public.project_roles TO authenticated;
GRANT ALL ON TABLE public.project_roles TO service_role;


--
-- Name: TABLE projects; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.projects TO anon;
GRANT ALL ON TABLE public.projects TO authenticated;
GRANT ALL ON TABLE public.projects TO service_role;


--
-- Name: TABLE public_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.public_profiles TO anon;
GRANT ALL ON TABLE public.public_profiles TO authenticated;
GRANT ALL ON TABLE public.public_profiles TO service_role;


--
-- Name: TABLE saved_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.saved_items TO anon;
GRANT ALL ON TABLE public.saved_items TO authenticated;
GRANT ALL ON TABLE public.saved_items TO service_role;


--
-- Name: TABLE work_samples; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.work_samples TO anon;
GRANT ALL ON TABLE public.work_samples TO authenticated;
GRANT ALL ON TABLE public.work_samples TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;  -- baseline fix: only supabase_admin may set these; new projects already have them
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;  -- baseline fix: only supabase_admin may set these; new projects already have them
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;  -- baseline fix: only supabase_admin may set these; new projects already have them
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;  -- baseline fix: only supabase_admin may set these; new projects already have them


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;  -- baseline fix: only supabase_admin may set these; new projects already have them
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;  -- baseline fix: only supabase_admin may set these; new projects already have them
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;  -- baseline fix: only supabase_admin may set these; new projects already have them
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;  -- baseline fix: only supabase_admin may set these; new projects already have them


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;  -- baseline fix: only supabase_admin may set these; new projects already have them
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;  -- baseline fix: only supabase_admin may set these; new projects already have them
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;  -- baseline fix: only supabase_admin may set these; new projects already have them
-- ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;  -- baseline fix: only supabase_admin may set these; new projects already have them


--
-- PostgreSQL database dump complete
--

\unrestrict De1hB8WwciKosuSMgyQ0NsIRE1S8xNNiSALbjphxiBMwk95khIDACc1fQ2aStDj

