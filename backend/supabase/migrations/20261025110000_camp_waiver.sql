-- Camp waiver (optional). The coach uploads a PDF or pastes an https link in the camp editor;
-- families open it from "I agree to <coach>'s camp waiver" on the Details screen. Publishing does
-- not need one.
--
-- coach_packages.camp_waiver_url: https only (the same rule save_camp checks). save_camp (from
-- its live definition) saves it, keeps it when the payload leaves it out, and defaults pay
-- directly to on for new camps; camp_json (editor, coach camps, save) and get_camp_page return it.
-- Uploads: PDFs to athalink-images/camp-waivers/<uuid>.pdf, insert only, coaches only, like the
-- camp covers. The bucket's 10 MB limit applies; the bucket now also takes application/pdf.

alter table public.coach_packages add column if not exists camp_waiver_url text;
alter table public.coach_packages drop constraint if exists coach_packages_camp_waiver_check;
alter table public.coach_packages add constraint coach_packages_camp_waiver_check
  check (
    camp_waiver_url is null
    or (camp_waiver_url ~ '^https://[^\s/?#]+\.[^\s]*$' and char_length(camp_waiver_url) <= 1000)
  );

update storage.buckets
  set allowed_mime_types = array_append(allowed_mime_types, 'application/pdf')
  where id = 'athalink-images'
    and allowed_mime_types is not null
    and not ('application/pdf' = any (allowed_mime_types));

drop policy if exists "Coaches upload camp waivers" on storage.objects;
create policy "Coaches upload camp waivers" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'athalink-images'
    and (storage.foldername(objects.name))[1] = 'camp-waivers'
    and lower(storage.extension(objects.name)) = 'pdf'
    and exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.coach_id is not null)
  );

CREATE OR REPLACE FUNCTION public.save_camp(p_camp_id uuid, p_camp jsonb, p_groups jsonb, p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach uuid := public.current_coach_id();
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

CREATE OR REPLACE FUNCTION public.camp_json(p_camp_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'id', pkg.id,
    'coach_id', pkg.coach_id,
    'name', pkg.package_name,
    'description', pkg.description,
    'price_cents', pkg.total_price,
    'starts_on', pkg.camp_starts_on,
    'ends_on', pkg.camp_ends_on,
    'days', case when pkg.camp_starts_on is null or pkg.camp_ends_on is null then null
                 else pkg.camp_ends_on - pkg.camp_starts_on + 1 end,
    'location', pkg.camp_location,
    'capacity', pkg.camp_capacity,
    'taken', public.camp_taken(pkg.id),
    'slug', pkg.camp_slug,
    'coach_slug', coach.slug,
    'cover_url', pkg.camp_cover_url,
    'included', pkg.camp_included,
    'tags', to_jsonb(pkg.camp_tags),
    'pay_direct', pkg.camp_pay_direct,
    'waiver_url', pkg.camp_waiver_url,
    'linked_coach', case when linked.id is null then null else jsonb_build_object(
      'id', linked.id, 'name', linked.name, 'slug', linked.slug,
      'photo_url', nullif(btrim(coalesce(linked.profile_image_url, linked.image_url, '')), '')
    ) end,
    'co_coach_ids', to_jsonb(pkg.co_coach_ids),
    'age_min', pkg.camp_age_min,
    'age_max', pkg.camp_age_max,
    'is_active', pkg.is_active,
    'published', pkg.camp_published_at is not null and pkg.is_active,
    'published_at', pkg.camp_published_at,
    'created_at', pkg.created_at,
    'updated_at', pkg.updated_at,
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', grp.id,
        'name', grp.name,
        'description', grp.description,
        'start_time', to_char(grp.start_time, 'HH24:MI'),
        'end_time', to_char(grp.end_time, 'HH24:MI'),
        'spots', grp.spots,
        'taken', public.camp_group_taken(grp.id),
        'sort_order', grp.sort_order
      ) order by grp.sort_order, grp.created_at)
      from public.camp_groups as grp
      where grp.camp_id = pkg.id
    ), '[]'::jsonb)
  )
  from public.coach_packages as pkg
  join public.coaches as coach on coach.id = pkg.coach_id
  left join public.coaches as linked on linked.id = pkg.camp_linked_coach_id and linked.deactivated_at is null
  where pkg.id = p_camp_id and pkg.kind = 'camp';
$function$;

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
    'open', pkg.camp_ends_on >= public.camp_today(),
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
    and pkg.camp_published_at is not null
    and pkg.camp_starts_on is not null
    and pkg.camp_ends_on is not null
  limit 1;
$function$;
