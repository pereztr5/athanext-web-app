-- Camps stop taking online sign-ups on their first day (Michael, Oct 30: a family signed up for a
-- camp already under way, and only some of its days were tracked). The camp page's "open" is now
-- false from the first camp day, with "started" so the page can say why, and camp_signup_start
-- refuses the same. Coaches still add late joiners themselves (add_camp_athlete has no date rule).

CREATE OR REPLACE FUNCTION public.get_camp_page(p_coach_slug text, p_camp_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'id', pkg.id,
    'name', pkg.package_name,
    'description', pkg.description,
    'tags', to_jsonb(pkg.camp_tags),
    'cover_url', coalesce(pkg.camp_cover_url, nullif(btrim(coalesce(coach.profile_image_url, coach.image_url, '')), '')),
    'cover_is_coach_photo', pkg.camp_cover_url is null,
    'price_cents', pkg.total_price,
    'days', pkg.camp_ends_on - pkg.camp_starts_on + 1,
    'per_day_cents', round(pkg.total_price::numeric / greatest(1, pkg.camp_ends_on - pkg.camp_starts_on + 1))::integer,
    'starts_on', pkg.camp_starts_on,
    'ends_on', pkg.camp_ends_on,
    'location', pkg.camp_location,
    'included', pkg.camp_included,
    'age_min', pkg.camp_age_min,
    'age_max', pkg.camp_age_max,
    'pay_direct', pkg.camp_pay_direct,
    'waiver_url', pkg.camp_waiver_url,
    'published', pkg.camp_published_at is not null,
    'can_edit', public.camp_editor_coach_id(pkg.id) is not null,
    -- Online sign-up closes on the first camp day; coaches add late joiners from Registrations.
    'open', coalesce(pkg.camp_starts_on, pkg.camp_ends_on) > public.camp_today(),
    'started', coalesce(pkg.camp_starts_on, pkg.camp_ends_on) <= public.camp_today(),
    'spots_left', case when pkg.camp_capacity is null then null
                       else greatest(0, pkg.camp_capacity - public.camp_taken(pkg.id)) end,
    'coach', jsonb_build_object(
      'id', coach.id,
      'name', coach.name,
      'slug', coach.slug,
      'photo_url', nullif(btrim(coalesce(coach.profile_image_url, coach.image_url, '')), ''),
      'bio', coach.bio,
      'years_experience', coach.years_experience,
      'rating', coach.rating,
      'total_reviews', coach.total_reviews,
      'cancellation_policy', coach.cancellation_policy
    ),
    'linked_coach', case when linked.id is null then null else jsonb_build_object(
      'id', linked.id,
      'name', linked.name,
      'slug', linked.slug,
      'photo_url', nullif(btrim(coalesce(linked.profile_image_url, linked.image_url, '')), '')
    ) end,
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'description', g.description,
        'start_time', to_char(g.start_time, 'HH24:MI'),
        'end_time', to_char(g.end_time, 'HH24:MI'),
        'spots', g.spots,
        'spots_left', g.spots_left,
        'full', g.spots_left <= 0
      ) order by g.sort_order, g.created_at)
      from (
        select grp.*,
          least(
            greatest(0, grp.spots - public.camp_group_taken(grp.id)),
            case when pkg.camp_capacity is null then grp.spots
                 else greatest(0, pkg.camp_capacity - public.camp_taken(pkg.id)) end
          ) as spots_left
        from public.camp_groups as grp
        where grp.camp_id = pkg.id
      ) as g
    ), '[]'::jsonb)
  )
  from public.coaches as coach
  join public.coach_packages as pkg on pkg.coach_id = coach.id
  left join public.coaches as linked on linked.id = pkg.camp_linked_coach_id and linked.deactivated_at is null
  where coach.slug = p_coach_slug
    and coach.deactivated_at is null
    and pkg.kind = 'camp'
    and pkg.camp_slug = p_camp_slug
    and pkg.is_active
    and (pkg.camp_published_at is not null or public.camp_editor_coach_id(pkg.id) is not null)
    and pkg.camp_starts_on is not null
    and pkg.camp_ends_on is not null
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.camp_signup_start(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_camp public.coach_packages%rowtype;
  v_coach public.coaches%rowtype;
  v_source text := p->>'source';
  v_pay text := p->>'pay_method';
  v_parent_name text := btrim(coalesce(p->'parent'->>'name', ''));
  v_email text := lower(btrim(coalesce(p->'parent'->>'email', '')));
  v_phone text := nullif(btrim(coalesce(p->'parent'->>'phone', '')), '');
  v_note text := nullif(btrim(coalesce(p->>'note', '')), '');
  v_ip text := nullif(btrim(coalesce(p->>'ip_hash', '')), '');
  v_hold_minutes integer := 40;
  v_per_ip integer := 5;
  v_per_email integer := 5;
  v_direct_per_email integer := 3;
  v_year integer := extract(year from now())::integer;
  v_athletes jsonb := p->'athletes';
  v_athlete jsonb;
  v_first text;
  v_last text;
  v_year_txt text;
  v_group uuid;
  v_groups uuid[] := '{}';
  v_names text[] := '{}';
  v_key text;
  v_is_client boolean;
  v_waived boolean;
  v_superseded text[];
  v_signup uuid;
  v_status text;
  v_hold timestamptz;
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  if v_source is null or v_source not in ('link', 'marketplace') then
    raise exception 'Unknown sign-up source' using errcode = '22023', hint = 'invalid';
  end if;
  if v_pay is null or v_pay not in ('card', 'direct') then
    raise exception 'Choose how to pay' using errcode = '22023', hint = 'invalid';
  end if;
  if coalesce(p->>'hold_minutes', '') ~ '^\d{1,3}$' then
    v_hold_minutes := least(60, greatest(31, (p->>'hold_minutes')::integer));
  end if;
  if coalesce(p->'limits'->>'per_ip_hour', '') ~ '^\d{1,3}$' then
    v_per_ip := (p->'limits'->>'per_ip_hour')::integer;
  end if;
  if coalesce(p->'limits'->>'per_email_hour', '') ~ '^\d{1,3}$' then
    v_per_email := (p->'limits'->>'per_email_hour')::integer;
  end if;
  if coalesce(p->'limits'->>'direct_per_email', '') ~ '^\d{1,3}$' then
    v_direct_per_email := (p->'limits'->>'direct_per_email')::integer;
  end if;

  if char_length(v_parent_name) not between 1 and 120 then
    raise exception 'Add your name' using errcode = '22023', hint = 'invalid';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Add an email we can send the receipt to' using errcode = '22023', hint = 'invalid';
  end if;
  if v_phone is not null and v_phone !~ '^[0-9+()\-. ]{7,30}$' then
    raise exception 'Add a phone number, like 555 123 4567' using errcode = '22023', hint = 'invalid';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters' using errcode = '22023', hint = 'invalid';
  end if;
  if coalesce((p->>'waiver')::boolean, false) is not true then
    raise exception 'Agree to the waiver to continue' using errcode = '22023', hint = 'invalid';
  end if;
  if (case when jsonb_typeof(v_athletes) = 'array' then jsonb_array_length(v_athletes) else 0 end) not between 1 and 6 then
    raise exception 'Add between 1 and 6 athletes' using errcode = '22023', hint = 'invalid';
  end if;

  for v_athlete in select value from jsonb_array_elements(v_athletes) loop
    v_first := btrim(coalesce(v_athlete->>'first_name', ''));
    v_last := btrim(coalesce(v_athlete->>'last_name', ''));
    v_year_txt := btrim(coalesce(v_athlete->>'birth_year', ''));
    if char_length(v_first) not between 1 and 60 then
      raise exception 'Add a first name' using errcode = '22023', hint = 'invalid';
    end if;
    if char_length(v_last) not between 1 and 60 then
      raise exception 'Add a last name' using errcode = '22023', hint = 'invalid';
    end if;
    if v_year_txt !~ '^\d{4}$' or v_year_txt::integer not between v_year - 80 and v_year - 2 then
      raise exception 'Add a birth year, like 2013' using errcode = '22023', hint = 'invalid';
    end if;
    if coalesce(v_athlete->>'note', '') <> '' and char_length(v_athlete->>'note') > 500 then
      raise exception 'Keep the note under 500 characters' using errcode = '22023', hint = 'invalid';
    end if;
    v_group := case
      when coalesce(v_athlete->>'group_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (v_athlete->>'group_id')::uuid
    end;
    if v_group is null then
      raise exception 'Pick a group for each athlete' using errcode = '22023', hint = 'invalid';
    end if;
    v_key := lower(v_first) || ' ' || lower(v_last);
    if v_key = any (v_names) then
      raise exception '% is on the form twice', v_first using errcode = '22023', hint = 'invalid';
    end if;
    v_names := v_names || v_key;
    v_groups := v_groups || v_group;
  end loop;

  -- Lock the camp: sign-ups for one camp run one at a time from here.
  if coalesce(p->>'camp_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_camp from public.coach_packages
    where id = (p->>'camp_id')::uuid and kind = 'camp'
    for update;
  end if;
  if v_camp.id is null then
    raise exception 'This camp is not taking sign-ups' using errcode = 'P0002', hint = 'closed';
  end if;
  select * into v_coach from public.coaches where id = v_camp.coach_id;
  if not v_camp.is_active or v_camp.camp_published_at is null or v_coach.deactivated_at is not null
     or v_camp.camp_ends_on is null
     or coalesce(v_camp.camp_starts_on, v_camp.camp_ends_on) <= public.camp_today() then
    raise exception 'This camp is not taking sign-ups' using errcode = 'P0002', hint = 'closed';
  end if;

  -- Tidy this camp's lapsed holds so they don't block the unique index below.
  update public.camp_registrations
    set status = 'expired'
    where camp_id = v_camp.id and status in ('pending_payment', 'held')
      and hold_expires_at is not null and hold_expires_at <= now();

  -- Rate limits.
  if v_ip is not null and (
    select count(*) from public.camp_signups
    where ip_hash = v_ip and created_at > now() - interval '1 hour' and source in ('link', 'marketplace')
  ) >= v_per_ip then
    raise exception 'Too many sign-ups from this device. Try again in an hour.' using errcode = 'P0001', hint = 'rate_ip';
  end if;
  if (
    select count(*) from public.camp_signups
    where lower(parent_email) = v_email and created_at > now() - interval '1 hour' and source in ('link', 'marketplace')
  ) >= v_per_email then
    raise exception 'Too many sign-ups for this email. Try again in an hour.' using errcode = 'P0001', hint = 'rate_email';
  end if;

  v_is_client := public.camp_email_is_client(v_camp.coach_id, v_email);
  -- Camps carry no platform fee, whoever signs up.
  v_waived := true;

  if v_pay = 'direct' then
    -- Offered to every family when the camp allows it (limits above and below still apply).
    if not v_camp.camp_pay_direct then
      raise exception 'Pay by card to hold this spot' using errcode = '22023', hint = 'direct_not_allowed';
    end if;
    if (
      select count(distinct reg.signup_id) from public.camp_registrations as reg
      where reg.camp_id = v_camp.id and lower(reg.parent_email) = v_email
        and reg.status = 'held' and reg.pay_method = 'direct'
    ) >= v_direct_per_email then
      raise exception 'This email already has spots waiting for payment. Pay the coach for those first.'
        using errcode = 'P0001', hint = 'rate_direct';
    end if;
  end if;

  -- A new attempt replaces this family's unpaid Checkout for the same camp.
  with superseded as (
    update public.camp_registrations
      set status = 'expired'
      where camp_id = v_camp.id and lower(parent_email) = v_email and status = 'pending_payment'
      returning stripe_session_id
  )
  select coalesce(array_agg(distinct stripe_session_id) filter (where stripe_session_id is not null), '{}')
    into v_superseded from superseded;

  perform public.camp_reserve(v_camp.id, v_groups);

  if v_pay = 'card' then
    v_status := 'pending_payment';
    v_hold := now() + make_interval(mins => v_hold_minutes);
  else
    v_status := 'held';
    v_hold := now() + interval '7 days';
  end if;

  insert into public.camp_signups (camp_id, coach_id, source, pay_method, parent_email, ip_hash, platform_waived)
  values (v_camp.id, v_camp.coach_id, v_source, v_pay, v_email, v_ip, v_waived)
  returning id into v_signup;

  begin
    for v_athlete in select value from jsonb_array_elements(v_athletes) loop
      insert into public.camp_registrations (
        camp_id, group_id, signup_id, coach_id, parent_name, parent_email, parent_phone,
        athlete_first_name, athlete_last_name, birth_year, note, waiver_accepted_at, photo_consent,
        source, pay_method, status, hold_expires_at, price_cents
      ) values (
        v_camp.id, (v_athlete->>'group_id')::uuid, v_signup, v_camp.coach_id, v_parent_name, v_email, v_phone,
        btrim(v_athlete->>'first_name'), btrim(v_athlete->>'last_name'), (v_athlete->>'birth_year')::integer,
        coalesce(nullif(btrim(coalesce(v_athlete->>'note', '')), ''), v_note), now(),
        coalesce((p->>'photo_consent')::boolean, false),
        v_source, v_pay, v_status, v_hold, v_camp.total_price
      )
      returning id into v_id;
      v_ids := v_ids || v_id;
    end loop;
  exception when unique_violation then
    raise exception 'One of these athletes already has a spot at this camp' using errcode = '23505', hint = 'duplicate';
  end;

  -- The family is now the coach's client (by email; their account is linked when they sign in).
  perform public.camp_link_client(
    v_camp.coach_id, v_email, v_parent_name, btrim(v_athletes->0->>'first_name'), null, null
  );

  return jsonb_build_object(
    'signup_id', v_signup,
    'registration_ids', to_jsonb(v_ids),
    'status', v_status,
    'hold_expires_at', v_hold,
    'platform_waived', v_waived,
    'is_client', v_is_client,
    'superseded_sessions', to_jsonb(v_superseded),
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'name', v_camp.package_name,
      'price_cents', v_camp.total_price,
      'starts_on', v_camp.camp_starts_on,
      'ends_on', v_camp.camp_ends_on,
      'location', v_camp.camp_location,
      'slug', v_camp.camp_slug,
      'coach_id', v_coach.id,
      'coach_name', v_coach.name,
      'coach_slug', v_coach.slug,
      'coach_email', v_coach.email
    ),
    'athletes', (
      select jsonb_agg(jsonb_build_object(
        'id', reg.id, 'first_name', reg.athlete_first_name, 'last_name', reg.athlete_last_name,
        'group_name', grp.name, 'start_time', to_char(grp.start_time, 'HH24:MI'), 'end_time', to_char(grp.end_time, 'HH24:MI')
      ) order by reg.created_at, reg.id)
      from public.camp_registrations as reg
      left join public.camp_groups as grp on grp.id = reg.group_id
      where reg.signup_id = v_signup
    )
  );
end;
$function$;
