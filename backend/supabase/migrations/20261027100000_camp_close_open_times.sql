-- Camps close the coach's open times under them (Oct 27).
--
-- Publishing a camp put its group sessions on top of the coach's open (unbooked) 1-on-1 and
-- group times without a word, so families could still book a time the coach spends at camp.
-- (ensure_no_occurrence_overlap never compares a camp row with a non-camp row: the
-- "o.camp_id = new.camp_id" test is null for non-camp rows, so camp rows skip them.)
--
-- Now, whenever camp_sync_schedule() builds a live camp (publish, save of a published camp):
--   * a booked session (requested, pending payment, booked, completed) under a camp group on a
--     camp day refuses the camp, as before intended: 23P01, hint schedule_clash;
--   * open, unbooked, published non-camp times under a camp group on a camp day are closed:
--     is_enabled = false, disabled_reason = 'camp'. Every family list (visible_sessions,
--     get_session_for_booking, intro and suggestion lists) and the booking checkout already
--     skip disabled times; fill_session_series doesn't recreate a series day that has a row.
-- camp_restore_open_times(coach) re-opens 'camp' rows that no enabled session covers any more
-- (and that aren't on a day off). It runs after every rebuild (moved groups or dates), after
-- unpublish (camp_sync_schedule on a camp that isn't live) and when a camp is deleted.
-- Rows another camp still covers stay closed. Past days are never touched.
--
-- camp_schedule_overlaps(starts_on, ends_on, groups) lets the camp editor say, before
-- publishing, how many open times will close and how many booked sessions are in the way.
--
-- Function bodies below are the live definitions with only these changes:
--   camp_sync_schedule   checks booked clashes, closes open times, restores freed ones.
--   camp_before_delete   restores the coach's open times after the camp rows go.
--   get_athlete_home     'next' gets is_camp, so Home shows camp times in the camp's zone.
-- Backfill at the end closes open times under camps that are live now (never booked ones).

alter table public.coach_availability_slot_occurrences drop constraint if exists slot_occ_disabled_reason;
alter table public.coach_availability_slot_occurrences add constraint slot_occ_disabled_reason
  check (disabled_reason = any (array['removed'::text, 'time_off'::text, 'replaced'::text, 'camp'::text]));

-- Non-camp, published times of a coach from today on that overlap any of p_times
-- ([{start_time, end_time}]) on a day between p_from and p_to: enabled ones and ones a camp closed.
create or replace function public.camp_overlapping_times(p_coach_id uuid, p_from date, p_to date, p_times jsonb)
returns table(occurrence_id uuid, occurrence_date date, start_time time, end_time time, booked boolean, closed boolean)
language sql
stable security definer
set search_path to 'public'
as $function$
  select occ.id, occ.occurrence_date, occ.start_time, occ.end_time,
    exists (
      select 1 from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
    ),
    not occ.is_enabled
  from public.coach_availability_slot_occurrences as occ
  where occ.coach_id = p_coach_id
    and occ.camp_id is null
    and not occ.is_draft
    and (occ.is_enabled or occ.disabled_reason = 'camp')
    and occ.occurrence_date between greatest(p_from, public.camp_today()) and p_to
    and exists (
      select 1 from jsonb_array_elements(coalesce(p_times, '[]'::jsonb)) as t
      where occ.start_time < (t->>'end_time')::time and (t->>'start_time')::time < occ.end_time
    );
$function$;

revoke all on function public.camp_overlapping_times(uuid, date, date, jsonb) from public, anon, authenticated;
grant execute on function public.camp_overlapping_times(uuid, date, date, jsonb) to service_role;

-- Re-open the coach's camp-closed times that nothing enabled covers any more. Row by row, so
-- a time that now clashes with something new just stays closed.
create or replace function public.camp_restore_open_times(p_coach_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_occ public.coach_availability_slot_occurrences%rowtype;
  v_n integer := 0;
begin
  for v_occ in
    select * from public.coach_availability_slot_occurrences as occ
    where occ.coach_id = p_coach_id
      and occ.camp_id is null
      and not occ.is_enabled
      and occ.disabled_reason = 'camp'
      and occ.occurrence_date >= public.camp_today()
    order by occ.occurrence_date, occ.start_time
  loop
    continue when exists (
      select 1 from public.coach_time_off as off
      where off.coach_id = p_coach_id and off.off_date = v_occ.occurrence_date
    );
    continue when exists (
      select 1 from public.coach_availability_slot_occurrences as other
      where other.coach_id = p_coach_id
        and other.occurrence_date = v_occ.occurrence_date
        and other.id <> v_occ.id
        and other.is_enabled
        and other.start_time < v_occ.end_time
        and v_occ.start_time < other.end_time
    );
    update public.coach_availability_slot_occurrences
      set is_enabled = true, disabled_reason = null
      where id = v_occ.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$function$;

revoke all on function public.camp_restore_open_times(uuid) from public, anon, authenticated;
grant execute on function public.camp_restore_open_times(uuid) to service_role;

-- Camp editor, before publishing: {"open": times that will close, "booked": sessions in the way}.
-- p_groups: [{start_time, end_time}] as the editor has them (saved or not).
create or replace function public.camp_schedule_overlaps(p_starts_on date, p_ends_on date, p_groups jsonb)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_coach uuid := public.current_coach_id();
  v_open integer := 0;
  v_booked integer := 0;
begin
  if v_coach is null then
    raise exception 'Only coaches can check camp times' using errcode = '42501';
  end if;
  if p_starts_on is null or jsonb_typeof(p_groups) is distinct from 'array' then
    return jsonb_build_object('open', 0, 'booked', 0);
  end if;
  if coalesce(p_ends_on, p_starts_on) < p_starts_on or coalesce(p_ends_on, p_starts_on) - p_starts_on > 366 then
    raise exception 'Pick camp dates within a year' using errcode = '22023';
  end if;
  select count(*) filter (where not t.booked), count(*) filter (where t.booked)
    into v_open, v_booked
  from public.camp_overlapping_times(v_coach, p_starts_on, coalesce(p_ends_on, p_starts_on), p_groups) as t;
  return jsonb_build_object('open', v_open, 'booked', v_booked);
end;
$function$;

revoke all on function public.camp_schedule_overlaps(date, date, jsonb) from public, anon;
grant execute on function public.camp_schedule_overlaps(date, date, jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.camp_sync_schedule(p_camp_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_camp public.coach_packages%rowtype;
  v_group public.camp_groups%rowtype;
  v_today date := public.camp_today();
  v_day date;
  v_days integer;
  v_groups integer;
  v_occ uuid;
  v_live boolean;
  v_n integer := 0;
  v_times jsonb;
  v_clash record;
begin
  select * into v_camp from public.coach_packages where id = p_camp_id and kind = 'camp';
  if not found then
    return 0;
  end if;
  v_live := v_camp.is_active and v_camp.camp_published_at is not null
    and v_camp.camp_starts_on is not null and v_camp.camp_ends_on is not null;

  for v_occ in
    select occ.id
    from public.coach_availability_slot_occurrences as occ
    where occ.camp_id = p_camp_id
      and occ.occurrence_date >= v_today
      and (
        not v_live
        or occ.camp_group_id is null
        or occ.occurrence_date not between v_camp.camp_starts_on and v_camp.camp_ends_on
        or not exists (select 1 from public.camp_groups as g where g.id = occ.camp_group_id and g.camp_id = p_camp_id)
      )
  loop
    perform public.camp_drop_occurrence(v_occ);
  end loop;

  if not v_live then
    -- Open times this camp closed come back once nothing else covers them.
    perform public.camp_restore_open_times(v_camp.coach_id);
    perform public.sync_camp_registration_bookings(reg.id)
    from public.camp_registrations as reg
    where reg.camp_id = p_camp_id and reg.status in ('held', 'paid');
    return 0;
  end if;

  -- A booked session under a camp group blocks the camp; open (unbooked) times close instead.
  v_times := coalesce((
    select jsonb_agg(jsonb_build_object('start_time', g.start_time, 'end_time', g.end_time))
    from public.camp_groups as g where g.camp_id = p_camp_id
  ), '[]'::jsonb);
  select * into v_clash
  from public.camp_overlapping_times(v_camp.coach_id, v_camp.camp_starts_on, v_camp.camp_ends_on, v_times) as t
  where t.booked
  order by t.occurrence_date, t.start_time
  limit 1;
  if found then
    raise exception 'You already have a booked session on % (% to %) during this camp. Move it, then try again.',
      to_char(v_clash.occurrence_date, 'Mon FMDD'), to_char(v_clash.start_time, 'FMHH12:MI AM'),
      to_char(v_clash.end_time, 'FMHH12:MI AM')
      using errcode = '23P01', hint = 'schedule_clash';
  end if;
  update public.coach_availability_slot_occurrences as occ
    set is_enabled = false, disabled_reason = 'camp'
  where occ.is_enabled
    and occ.id in (
      select t.occurrence_id
      from public.camp_overlapping_times(v_camp.coach_id, v_camp.camp_starts_on, v_camp.camp_ends_on, v_times) as t
      where not t.booked and not t.closed
    );

  v_days := v_camp.camp_ends_on - v_camp.camp_starts_on + 1;
  select count(*) into v_groups from public.camp_groups where camp_id = p_camp_id;

  for v_group in select * from public.camp_groups where camp_id = p_camp_id order by sort_order, created_at loop
    for v_day in
      select d::date from generate_series(greatest(v_camp.camp_starts_on, v_today), v_camp.camp_ends_on, interval '1 day') as d
    loop
      begin
        insert into public.coach_availability_slot_occurrences as occ (
          coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
          session_type, location, place, visibility, offered_to, details, is_draft, is_enabled,
          max_bookings_per_slot, camp_id, camp_group_id, camp_day_index
        ) values (
          v_camp.coach_id, v_day,
          left(v_camp.package_name || case when v_groups > 1 then ' · ' || v_group.name else '' end, 160),
          round(v_camp.total_price / 100.0, 2),
          (extract(epoch from (v_group.end_time - v_group.start_time)) / 60)::integer,
          v_group.start_time, v_group.end_time,
          -- 'offered' to nobody: no family list shows it even where camp_id isn't checked.
          'group', 'in-person', v_camp.camp_location, 'offered', '{}',
          jsonb_build_object(
            'camp_id', v_camp.id, 'camp_group_id', v_group.id,
            'day_index', v_day - v_camp.camp_starts_on + 1, 'days_total', v_days
          ),
          false, true, v_group.spots, v_camp.id, v_group.id, (v_day - v_camp.camp_starts_on + 1)::smallint
        )
        on conflict (camp_group_id, occurrence_date) where camp_group_id is not null do update
          set session_name = excluded.session_name,
              price = excluded.price,
              duration_minutes = excluded.duration_minutes,
              start_time = excluded.start_time,
              end_time = excluded.end_time,
              place = excluded.place,
              visibility = 'offered',
              offered_to = '{}',
              details = excluded.details,
              is_draft = false,
              is_enabled = true,
              disabled_reason = null,
              max_bookings_per_slot = excluded.max_bookings_per_slot,
              camp_id = excluded.camp_id,
              camp_day_index = excluded.camp_day_index;
      exception when raise_exception then
        raise exception 'You already have a session on % that overlaps % (% to %). Move it, then try again.',
          to_char(v_day, 'Mon FMDD'), v_group.name, to_char(v_group.start_time, 'FMHH12:MI AM'),
          to_char(v_group.end_time, 'FMHH12:MI AM')
          using errcode = '23P01', hint = 'schedule_clash';
      end;
      v_n := v_n + 1;
    end loop;
  end loop;
  -- Times closed for a group or day the camp no longer has open again.
  perform public.camp_restore_open_times(v_camp.coach_id);
  -- Camp rosters follow the rebuilt days.
  perform public.sync_camp_registration_bookings(reg.id)
  from public.camp_registrations as reg
  where reg.camp_id = p_camp_id and reg.status in ('held', 'paid');
  return v_n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.camp_before_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_occ uuid;
begin
  if old.kind = 'camp' then
    for v_occ in
      select id from public.coach_availability_slot_occurrences where camp_id = old.id
    loop
      perform public.camp_drop_occurrence(v_occ);
    end loop;
    perform public.camp_restore_open_times(old.coach_id);
  end if;
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_athlete_home()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_athlete uuid := public.current_athlete_id();
  v_next record;
begin
  if v_athlete is null then
    return null;
  end if;

  select occ.id, occ.occurrence_date, occ.start_time, occ.end_time, occ.session_type, occ.session_name,
         occ.pillar_slot, coalesce(occ.place, occ.location) as place, coach.name as coach_name, booking.status,
         case when occ.camp_id is not null then
           'Camp · ' || coalesce((select camp.package_name from public.coach_packages as camp where camp.id = occ.camp_id), 'Camp')
           || coalesce(' · Day ' || occ.camp_day_index, '')
         end as camp_title
    into v_next
  from public.coach_slot_bookings as booking
  join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
  join public.coaches as coach on coach.id = booking.coach_id
  where booking.athlete_id = v_athlete
    and booking.status in ('requested', 'pending_payment', 'booked')
    and public.eastern_timestamp(occ.occurrence_date, occ.end_time) > now()
  order by occ.occurrence_date, occ.start_time
  limit 1;

  return jsonb_build_object(
    'athlete', (
      select jsonb_build_object(
        'id', a.id,
        'full_name', a.full_name,
        'date_of_birth', a.date_of_birth,
        'sport', a.sport,
        'position', a.position,
        'team', nullif(a.high_school, ''),
        'graduation_year', a.graduation_year,
        'pathway', a.pathway_tags[1],
        'season_goal', a.season_goal,
        'highlight_video_url', a.highlight_video_url,
        'photo', a.profile_image_url
      )
      from public.athlete_profiles as a where a.id = v_athlete
    ),
    'next', case when v_next.id is null then null else jsonb_build_object(
      'id', v_next.id,
      'date', v_next.occurrence_date,
      'start_time', v_next.start_time,
      'end_time', v_next.end_time,
      'title', case when v_next.camp_title is not null then v_next.camp_title
                    when v_next.session_type = 'group' then coalesce(v_next.session_name, 'Group session')
                    else coalesce(v_next.pillar_slot, '1-on-1') end,
      'place', v_next.place,
      'coach_name', v_next.coach_name,
      'status', v_next.status,
      'is_camp', v_next.camp_title is not null
    ) end,
    -- What they're working on: the latest note or summary a coach shared after a session they came to.
    'focus', (
      select jsonb_build_object(
        'text', coalesce(nullif(note.feedback_to_athlete, ''), feedback.summary),
        'coach_name', coach.name,
        'date', occ.occurrence_date
      )
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
      join public.coaches as coach on coach.id = booking.coach_id
      left join public.session_feedback_v2 as feedback on feedback.slot_id = occ.id and not feedback.no_show
      left join public.slot_feedback_v2 as note on note.booking_id = booking.id
      left join public.slot_attendance_v2 as attendance on attendance.booking_id = booking.id
      where booking.athlete_id = v_athlete
        and coalesce(attendance.attendance::text, 'present') = 'present'
        and coalesce(nullif(note.feedback_to_athlete, ''), feedback.summary) is not null
      order by occ.occurrence_date desc, occ.start_time desc
      limit 1
    ),
    'coaches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', coach.id,
        'name', coach.name,
        'slug', coach.slug,
        'photo', coalesce(coach.profile_image_url, coach.image_url),
        'next_date', (
          select min(occ.occurrence_date)
          from public.coach_slot_bookings as b
          join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
          where b.athlete_id = v_athlete and b.coach_id = coach.id
            and b.status in ('requested', 'pending_payment', 'booked')
            and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
        ),
        'credits_left', public.coach_credits_left(coach.id, v_athlete)
      ) order by coach.name)
      from public.coaches as coach
      where coach.id in (select public.athlete_coach_ids(v_athlete))
        and coach.id not in (
          select hidden.coach_id from public.athlete_hidden_coaches as hidden where hidden.user_id = auth.uid()
        )
    ), '[]'::jsonb)
  );
end;
$function$;


-- Backfill: close open, unbooked times under camps that are live now. Booked clashes are left
-- alone (they show on the coach's schedule and block the camp's next save).
do $$
declare
  v_camp record;
begin
  for v_camp in
    select camp.id, camp.coach_id, camp.camp_starts_on, camp.camp_ends_on
    from public.coach_packages as camp
    where camp.kind = 'camp' and camp.is_active and camp.camp_published_at is not null
      and camp.camp_starts_on is not null and camp.camp_ends_on >= public.camp_today()
  loop
    update public.coach_availability_slot_occurrences as occ
      set is_enabled = false, disabled_reason = 'camp'
    where occ.is_enabled
      and occ.id in (
        select t.occurrence_id
        from public.camp_overlapping_times(
          v_camp.coach_id, v_camp.camp_starts_on, v_camp.camp_ends_on,
          coalesce((
            select jsonb_agg(jsonb_build_object('start_time', g.start_time, 'end_time', g.end_time))
            from public.camp_groups as g where g.camp_id = v_camp.id
          ), '[]'::jsonb)
        ) as t
        where not t.booked and not t.closed
      );
  end loop;
end;
$$;
