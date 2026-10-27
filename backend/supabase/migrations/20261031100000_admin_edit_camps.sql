-- Admins edit another coach's existing camp (same editor as the coach).
-- camp_editor_coach_id: owning coach, or that camp's coach when is_admin().
-- Creating a camp for someone else stays unsupported (null camp id => current coach only).
-- Safe to run more than once.

create or replace function public.camp_editor_coach_id(p_camp_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_me uuid := public.current_coach_id();
  v_owner uuid;
begin
  if p_camp_id is null then
    return v_me;
  end if;
  select coach_id into v_owner
  from public.coach_packages
  where id = p_camp_id and kind = 'camp';
  if v_owner is null then
    return null;
  end if;
  if v_me is not null and v_me = v_owner then
    return v_owner;
  end if;
  if public.is_admin() then
    return v_owner;
  end if;
  return null;
end;
$$;

revoke all on function public.camp_editor_coach_id(uuid) from public, anon;
grant execute on function public.camp_editor_coach_id(uuid) to authenticated;

create or replace function public.admin_list_camps(p_coach_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can list another coach camps' using errcode = '42501';
  end if;
  if p_coach_id is null then
    raise exception 'Coach is required' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(public.camp_json(pkg.id) || jsonb_build_object(
      'paid_count', (select count(*) from public.camp_registrations r where r.camp_id = pkg.id and r.status = 'paid'),
      'waiting_count', (select count(*) from public.camp_registrations r
                        where r.camp_id = pkg.id and r.status = 'held' and public.camp_reg_holds_spot(r.status, r.hold_expires_at))
    ) order by pkg.camp_starts_on desc nulls first, pkg.created_at desc)
    from public.coach_packages as pkg
    where pkg.kind = 'camp' and pkg.coach_id = p_coach_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_camps(uuid) from public, anon;
grant execute on function public.admin_list_camps(uuid) to authenticated;

create or replace function public.get_camp_editor(p_camp_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if public.camp_editor_coach_id(p_camp_id) is null then
    raise exception 'Camp not found' using errcode = 'P0002';
  end if;
  return public.camp_json(p_camp_id);
end;
$$;

create or replace function public.publish_camp(p_camp_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_coach uuid := public.camp_editor_coach_id(p_camp_id);
  v_camp public.coach_packages%rowtype;
  v_missing text[] := '{}';
  v_sessions integer;
begin
  if v_coach is null then
    raise exception 'Camp not found' using errcode = 'P0002';
  end if;
  select * into v_camp from public.coach_packages
  where id = p_camp_id and kind = 'camp' and coach_id = v_coach
  for update;
  if not found then
    raise exception 'Camp not found' using errcode = 'P0002';
  end if;
  if v_camp.camp_starts_on is null or v_camp.camp_ends_on is null then
    v_missing := v_missing || 'dates'::text;
  end if;
  if v_camp.camp_location is null then
    v_missing := v_missing || 'location'::text;
  end if;
  if not exists (select 1 from public.camp_groups where camp_id = v_camp.id) then
    v_missing := v_missing || 'groups'::text;
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'Add the camp''s %', array_to_string(v_missing, ', ') using errcode = '22023', hint = 'incomplete';
  end if;
  if v_camp.camp_ends_on < public.camp_today() then
    raise exception 'This camp has already ended' using errcode = '22023';
  end if;
  if v_camp.camp_slug is null then
    update public.coach_packages
      set camp_slug = public.camp_unique_slug(v_camp.coach_id, v_camp.package_name, v_camp.id)
      where id = v_camp.id;
  end if;
  update public.coach_packages
    set camp_published_at = coalesce(camp_published_at, now()), is_active = true
    where id = v_camp.id;
  v_sessions := public.camp_sync_schedule(v_camp.id);
  return public.camp_json(v_camp.id) || jsonb_build_object('schedule_sessions', v_sessions);
end;
$$;

create or replace function public.unpublish_camp(p_camp_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_coach uuid := public.camp_editor_coach_id(p_camp_id);
begin
  if v_coach is null then
    raise exception 'Camp not found' using errcode = 'P0002';
  end if;
  update public.coach_packages
    set camp_published_at = null, is_active = false
    where id = p_camp_id and kind = 'camp' and coach_id = v_coach;
  if not found then
    raise exception 'Camp not found' using errcode = 'P0002';
  end if;
  perform public.camp_sync_schedule(p_camp_id);
  return public.camp_json(p_camp_id);
end;
$$;


CREATE OR REPLACE FUNCTION public.save_camp(p_camp_id uuid, p_camp jsonb, p_groups jsonb, p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach uuid := public.camp_editor_coach_id(p_camp_id);
  v_camp public.coach_packages%rowtype;
  v_today date := public.camp_today();
  v_name text := btrim(coalesce(p_camp->>'name', ''));
  v_desc text := nullif(btrim(coalesce(p_camp->>'description', '')), '');
  v_location text := nullif(btrim(coalesce(p_camp->>'location', '')), '');
  v_cover text := nullif(btrim(coalesce(p_camp->>'cover_url', '')), '');
  v_price integer;
  v_starts date;
  v_ends date;
  v_included jsonb := '[]'::jsonb;
  v_tags text[] := '{}';
  v_pay_direct boolean := (p_camp->>'pay_direct')::boolean;
  v_waiver text := nullif(btrim(coalesce(p_camp->>'waiver_url', '')), '');
  v_linked uuid;
  v_age_min integer;
  v_age_max integer;
  v_item jsonb;
  v_text text;
  v_count integer;
  v_row jsonb;
  v_gid uuid;
  v_gname text;
  v_gdesc text;
  v_gstart time;
  v_gend time;
  v_gspots integer;
  v_taken integer;
  v_keep uuid[] := '{}';
  v_names text[] := '{}';
  v_i integer := 0;
  v_total integer := 0;
  v_min_start time;
  v_max_end time;
  v_max_minutes integer := 0;
  v_days integer;
  v_old record;
  v_uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if v_coach is null then
    raise exception 'Only coaches can save camps' using errcode = '42501';
  end if;
  if jsonb_typeof(p_camp) is distinct from 'object' then
    raise exception 'Send the camp details' using errcode = '22023';
  end if;
  if (case when jsonb_typeof(p_groups) = 'array' then jsonb_array_length(p_groups) else 0 end) = 0 then
    raise exception 'Add at least one group' using errcode = '22023', hint = 'groups_required';
  end if;
  v_count := jsonb_array_length(p_groups);
  if v_count > 4 then
    raise exception 'A camp can have up to 4 groups' using errcode = '22023', hint = 'too_many_groups';
  end if;

  -- Camp fields.
  if char_length(v_name) not between 1 and 100 then
    raise exception 'Add a camp name' using errcode = '22023';
  end if;
  if v_desc is not null and char_length(v_desc) > 500 then
    raise exception 'Keep the description under 500 characters' using errcode = '22023';
  end if;
  if coalesce(p_camp->>'price_cents', '') !~ '^\d{1,7}$' or (p_camp->>'price_cents')::integer not between 100 and 1000000 then
    raise exception 'Add a price per athlete' using errcode = '22023';
  end if;
  v_price := (p_camp->>'price_cents')::integer;
  if coalesce(p_camp->>'starts_on', '') <> '' then
    if p_camp->>'starts_on' !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Pick a start date' using errcode = '22023';
    end if;
    v_starts := (p_camp->>'starts_on')::date;
  end if;
  if coalesce(p_camp->>'ends_on', '') <> '' then
    if p_camp->>'ends_on' !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Pick an end date' using errcode = '22023';
    end if;
    v_ends := (p_camp->>'ends_on')::date;
  end if;
  if v_starts is not null and v_ends is null then
    v_ends := v_starts; -- same day twice = a one-day camp
  end if;
  if v_ends is not null and v_starts is null then
    raise exception 'Pick a start date' using errcode = '22023';
  end if;
  if v_starts is not null and v_ends < v_starts then
    raise exception 'The camp ends before it starts' using errcode = '22023';
  end if;
  if v_starts is not null and v_ends - v_starts + 1 > 60 then
    raise exception 'A camp can last up to 60 days' using errcode = '22023';
  end if;
  if v_location is not null and char_length(v_location) > 200 then
    raise exception 'Keep the location under 200 characters' using errcode = '22023';
  end if;
  if v_cover is not null and (v_cover !~ '^https://' or char_length(v_cover) > 1000) then
    raise exception 'Upload the cover photo again' using errcode = '22023';
  end if;
  if v_waiver is not null and (v_waiver !~ '^https://[^\s/?#]+\.[^\s]*$' or char_length(v_waiver) > 1000) then
    raise exception 'Add a waiver link that starts with https://' using errcode = '22023';
  end if;
  if p_camp ? 'included' and jsonb_typeof(p_camp->'included') = 'array' then
    for v_item in select value from jsonb_array_elements(p_camp->'included') loop
      v_text := btrim(coalesce(v_item #>> '{}', ''));
      continue when v_text = '';
      if char_length(v_text) > 120 then
        raise exception 'Keep each included item under 120 characters' using errcode = '22023';
      end if;
      v_included := v_included || to_jsonb(v_text);
    end loop;
    if jsonb_array_length(v_included) > 12 then
      raise exception 'List up to 12 included items' using errcode = '22023';
    end if;
  end if;
  if p_camp ? 'tags' and jsonb_typeof(p_camp->'tags') = 'array' then
    for v_item in select value from jsonb_array_elements(p_camp->'tags') loop
      v_text := btrim(coalesce(v_item #>> '{}', ''));
      continue when v_text = '' or v_text = any (v_tags);
      if char_length(v_text) > 30 then
        raise exception 'Keep each tag under 30 characters' using errcode = '22023';
      end if;
      v_tags := v_tags || v_text;
    end loop;
    if cardinality(v_tags) > 6 then
      raise exception 'Add up to 6 tags' using errcode = '22023';
    end if;
  end if;
  if coalesce(p_camp->>'linked_coach_id', '') <> '' then
    if p_camp->>'linked_coach_id' !~* v_uuid_re then
      raise exception 'Pick the coach to link again' using errcode = '22023';
    end if;
    v_linked := (p_camp->>'linked_coach_id')::uuid;
    if v_linked = v_coach then
      raise exception 'You are already the coach for this camp' using errcode = '22023';
    end if;
    if not exists (select 1 from public.coaches where id = v_linked and deactivated_at is null) then
      raise exception 'That coach is not on AthaNext anymore' using errcode = '22023';
    end if;
  end if;
  if coalesce(p_camp->>'age_min', '') ~ '^\d{1,2}$' then
    v_age_min := (p_camp->>'age_min')::integer;
  end if;
  if coalesce(p_camp->>'age_max', '') ~ '^\d{1,2}$' then
    v_age_max := (p_camp->>'age_max')::integer;
  end if;
  if (v_age_min is not null and v_age_min not between 1 and 99) or (v_age_max is not null and v_age_max not between 1 and 99) then
    raise exception 'Ages must be between 1 and 99' using errcode = '22023';
  end if;
  if v_age_min is not null and v_age_max is not null and v_age_max < v_age_min then
    raise exception 'The oldest age is below the youngest age' using errcode = '22023';
  end if;

  -- Groups: validate everything before writing anything.
  for v_row in select value from jsonb_array_elements(p_groups) loop
    if jsonb_typeof(v_row) is distinct from 'object' then
      raise exception 'Send each group as an object' using errcode = '22023';
    end if;
    v_gname := btrim(coalesce(v_row->>'name', ''));
    if v_gname = '' then
      if v_count > 1 then
        raise exception 'Name each group' using errcode = '22023';
      end if;
      v_gname := 'All athletes';
    end if;
    if char_length(v_gname) > 60 then
      raise exception 'Keep group names under 60 characters' using errcode = '22023';
    end if;
    if lower(v_gname) = any (v_names) then
      raise exception 'Two groups are called %', v_gname using errcode = '22023';
    end if;
    v_names := v_names || lower(v_gname);
    if coalesce(v_row->>'description', '') <> '' and char_length(btrim(v_row->>'description')) > 280 then
      raise exception 'Keep group descriptions under 280 characters' using errcode = '22023';
    end if;
    if coalesce(v_row->>'start_time', '') !~ '^([01]\d|2[0-1]):(00|30)$'
       or coalesce(v_row->>'end_time', '') !~ '^([01]\d|2[0-1]):(00|30)$' then
      raise exception 'Pick % times in half hours between 7am and 9pm', v_gname using errcode = '22023';
    end if;
    v_gstart := (v_row->>'start_time')::time;
    v_gend := (v_row->>'end_time')::time;
    if v_gstart < time '07:00' or v_gend > time '21:00' or v_gend <= v_gstart then
      raise exception 'Pick % times in half hours between 7am and 9pm', v_gname using errcode = '22023';
    end if;
    if coalesce(v_row->>'spots', '') !~ '^\d{1,2}$' or (v_row->>'spots')::integer not between 1 and 60 then
      raise exception 'Give % between 1 and 60 spots', v_gname using errcode = '22023';
    end if;
    if coalesce(v_row->>'id', '') <> '' and v_row->>'id' !~* v_uuid_re then
      raise exception 'Reload the camp and try again' using errcode = '22023';
    end if;
  end loop;

  -- Camp row (locked, so sign-ups wait for this save).
  if p_camp_id is null then
    if v_starts is not null and v_starts < v_today then
      raise exception 'Pick a start date from today on' using errcode = '22023';
    end if;
    insert into public.coach_packages (
      coach_id, kind, package_name, description, session_count, duration_minutes, total_price,
      validity_days, features, is_active, camp_slug
    ) values (
      v_coach, 'camp', v_name, v_desc, 1, 60, v_price, 1, '[]'::jsonb, false,
      public.camp_unique_slug(v_coach, coalesce(nullif(p_camp->>'slug', ''), v_name), null)
    )
    returning * into v_camp;
  else
    select * into v_camp from public.coach_packages
    where id = p_camp_id and kind = 'camp' and coach_id = v_coach
    for update;
    if not found then
      raise exception 'Camp not found' using errcode = 'P0002';
    end if;
    if p_expected_updated_at is not null and v_camp.updated_at is distinct from p_expected_updated_at then
      raise exception 'This camp was changed somewhere else. Reload it and try again.'
        using errcode = '40001', hint = 'stale';
    end if;
    if v_starts is not null and v_starts is distinct from v_camp.camp_starts_on and v_starts < v_today then
      raise exception 'Pick a start date from today on' using errcode = '22023';
    end if;
  end if;
  -- Left out: new camps let families pay directly, saved camps keep their setting. The waiver
  -- left out of the payload stays as it is.
  v_pay_direct := coalesce(v_pay_direct, case when p_camp_id is null then true else v_camp.camp_pay_direct end);
  if not (p_camp ? 'waiver_url') then
    v_waiver := v_camp.camp_waiver_url;
  end if;

  -- Groups left out of the list: delete (the guard trigger refuses groups with athletes).
  for v_old in
    select grp.id, grp.name from public.camp_groups as grp
    where grp.camp_id = v_camp.id
      and grp.id not in (
        select (value->>'id')::uuid from jsonb_array_elements(p_groups)
        where coalesce(value->>'id', '') <> ''
      )
    for update
  loop
    if public.camp_group_taken(v_old.id) > 0 then
      raise exception '% has athletes signed up. Move or cancel them first.', v_old.name
        using errcode = '23503', hint = 'group_has_athletes';
    end if;
    delete from public.camp_groups where id = v_old.id;
  end loop;

  for v_row in select value from jsonb_array_elements(p_groups) loop
    v_gname := coalesce(nullif(btrim(coalesce(v_row->>'name', '')), ''), 'All athletes');
    v_gdesc := nullif(btrim(coalesce(v_row->>'description', '')), '');
    v_gstart := (v_row->>'start_time')::time;
    v_gend := (v_row->>'end_time')::time;
    v_gspots := (v_row->>'spots')::integer;
    v_gid := null;
    if coalesce(v_row->>'id', '') <> '' then
      select id into v_gid from public.camp_groups
      where id = (v_row->>'id')::uuid and camp_id = v_camp.id
      for update;
      if v_gid is null then
        raise exception 'Reload the camp and try again' using errcode = 'P0002', hint = 'stale';
      end if;
      v_taken := public.camp_group_taken(v_gid);
      if v_gspots < v_taken then
        raise exception '% already has % athletes. Give it at least % spots.', v_gname, v_taken, v_taken
          using errcode = '22023', hint = 'spots_below_taken';
      end if;
      update public.camp_groups
        set name = v_gname, description = v_gdesc, start_time = v_gstart, end_time = v_gend,
            spots = v_gspots, sort_order = v_i
        where id = v_gid;
    else
      insert into public.camp_groups (camp_id, name, description, start_time, end_time, spots, sort_order)
      values (v_camp.id, v_gname, v_gdesc, v_gstart, v_gend, v_gspots, v_i)
      returning id into v_gid;
    end if;
    v_keep := v_keep || v_gid;
    v_total := v_total + v_gspots;
    v_min_start := least(coalesce(v_min_start, v_gstart), v_gstart);
    v_max_end := greatest(coalesce(v_max_end, v_gend), v_gend);
    v_max_minutes := greatest(v_max_minutes, (extract(epoch from (v_gend - v_gstart)) / 60)::integer);
    v_i := v_i + 1;
  end loop;

  -- Camp capacity is the sum of the groups, never below what is already taken.
  v_taken := public.camp_taken(v_camp.id);
  if v_total < v_taken then
    raise exception '% athletes already have a spot. Add spots so the groups hold at least %.', v_taken, v_taken
      using errcode = '22023', hint = 'spots_below_taken';
  end if;

  v_days := case when v_starts is null then 1 else v_ends - v_starts + 1 end;
  update public.coach_packages
    set package_name = v_name,
        updated_at = now(),
        description = v_desc,
        total_price = v_price,
        session_count = v_days,
        duration_minutes = greatest(1, v_max_minutes),
        validity_days = greatest(1, coalesce(v_ends - v_today + 1, 1)),
        features = v_included,
        camp_starts_on = v_starts,
        camp_ends_on = v_ends,
        camp_daily_start = v_min_start,
        camp_daily_end = v_max_end,
        camp_location = v_location,
        camp_capacity = v_total,
        camp_age_min = v_age_min,
        camp_age_max = v_age_max,
        camp_cover_url = v_cover,
        camp_included = v_included,
        camp_tags = v_tags,
        camp_pay_direct = v_pay_direct,
        camp_waiver_url = v_waiver,
        camp_linked_coach_id = v_linked,
        co_coach_ids = case
          when p_camp ? 'co_coach_ids' and jsonb_typeof(p_camp->'co_coach_ids') = 'array' then coalesce((
            select array_agg(distinct (value #>> '{}')::uuid)
            from jsonb_array_elements(p_camp->'co_coach_ids')
            where (value #>> '{}') ~* v_uuid_re
          ), '{}'::uuid[])
          else co_coach_ids
        end
    where id = v_camp.id;

  if v_camp.camp_published_at is not null then
    if v_starts is null or v_location is null then
      raise exception 'A published camp needs its dates and location' using errcode = '22023';
    end if;
    perform public.camp_sync_schedule(v_camp.id);
  end if;

  return public.camp_json(v_camp.id);
end;
$function$;

create or replace function public.get_camp_registrations(p_camp_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.camp_editor_coach_id(p_camp_id);
begin
  if v_coach is null then
    raise exception 'Camp not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'camp', public.camp_json(p_camp_id),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', grp.id,
        'name', grp.name,
        'start_time', to_char(grp.start_time, 'HH24:MI'),
        'end_time', to_char(grp.end_time, 'HH24:MI'),
        'spots', grp.spots,
        'taken', public.camp_group_taken(grp.id),
        'paid', (select count(*) from public.camp_registrations r where r.group_id = grp.id and r.status = 'paid'),
        'waiting', (select count(*) from public.camp_registrations r
                    where r.group_id = grp.id and r.status = 'held' and public.camp_reg_holds_spot(r.status, r.hold_expires_at))
      ) order by grp.sort_order, grp.created_at)
      from public.camp_groups as grp
      where grp.camp_id = p_camp_id
    ), '[]'::jsonb),
    'legacy_purchases', (
      select count(*) from public.package_purchases as purchase
      where purchase.package_id = p_camp_id and purchase.camp_signup_id is null
        and purchase.status in ('active', 'expired', 'completed')
    ),
    'paid_cents', coalesce((
      select sum(reg.price_cents) from public.camp_registrations as reg
      where reg.camp_id = p_camp_id and reg.status = 'paid'
    ), 0),
    'to_collect_cents', coalesce((
      select sum(reg.price_cents) from public.camp_registrations as reg
      where reg.camp_id = p_camp_id and reg.status = 'held' and public.camp_reg_holds_spot(reg.status, reg.hold_expires_at)
    ), 0),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', reg.id,
        'signup_id', reg.signup_id,
        'group_id', reg.group_id,
        'group_name', grp.name,
        'athlete_first_name', reg.athlete_first_name,
        'athlete_last_name', reg.athlete_last_name,
        'athlete_id', reg.athlete_id,
        'birth_year', reg.birth_year,
        'parent_name', reg.parent_name,
        'parent_email', reg.parent_email,
        'parent_phone', reg.parent_phone,
        'note', reg.note,
        'waiver_accepted_at', reg.waiver_accepted_at,
        'photo_consent', reg.photo_consent,
        'source', reg.source,
        'pay_method', reg.pay_method,
        'status', reg.status,
        'display_status', case
          when reg.status = 'paid' and reg.pay_method = 'card' then 'paid_in_app'
          when reg.status = 'paid' then 'paid_outside'
          when reg.status = 'held' then 'waiting'
          else 'paying'
        end,
        'price_cents', reg.price_cents,
        'paid_at', reg.paid_at,
        'hold_expires_at', reg.hold_expires_at,
        'created_at', reg.created_at,
        'account', case
          when reg.user_id is not null then 'joined'
          when reg.parent_email is null then 'no_email'
          when exists (select 1 from public.user_profiles as up where lower(up.email) = lower(reg.parent_email)) then 'joined'
          else 'not_finished'
        end,
        'finish_emailed_at', reg.finish_emailed_at,
        'invite', (
          select jsonb_build_object(
            'id', ref.id,
            'status', case
              when ref.status = 'confirmed' then 'joined'
              when ref.opened_at is not null then 'opened'
              else 'sent'
            end,
            'sent_at', coalesce(ref.updated_at, ref.created_at),
            'opened_at', ref.opened_at,
            'resend_count', ref.resend_count
          )
          from public.coach_client_referrals as ref
          where ref.coach_id = reg.coach_id and reg.parent_email is not null
            and lower(ref.client_email) = lower(reg.parent_email)
          order by ref.created_at desc
          limit 1
        )
      ) order by grp.sort_order nulls last, reg.created_at)
      from public.camp_registrations as reg
      left join public.camp_groups as grp on grp.id = reg.group_id
      where reg.camp_id = p_camp_id
        and public.camp_reg_holds_spot(reg.status, reg.hold_expires_at)
    ), '[]'::jsonb)
  );
end;
$$;
