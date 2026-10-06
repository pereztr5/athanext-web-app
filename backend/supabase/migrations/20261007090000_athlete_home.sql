-- ATH-92: Athlete Home, the athlete's dashboard and profile in one.
-- 1. Season goal and highlight video on the athlete profile ("Club or team" is high_school).
-- 2. get_athlete_home: player card, next session with what they're working on, and coaches
--    with their next session and sessions left.
-- 3. Coaches who only have a request see the request card preview (first name, age group,
--    position), not the full athlete page: a request no longer puts an athlete on the roster.
-- 4. The coach's athlete page shows the season goal and highlight video.

alter table public.athlete_profiles
  add column if not exists season_goal text check (char_length(season_goal) <= 300),
  add column if not exists highlight_video_url text check (char_length(highlight_video_url) <= 500);

create or replace function public.coach_roster_ids(p_coach_id uuid)
returns setof uuid
language sql
stable security definer
set search_path = public
as $$
  select booking.athlete_id
  from public.coach_slot_bookings as booking
  where booking.coach_id = p_coach_id
    and booking.status in ('pending_payment', 'booked', 'completed', 'no_show')
  union
  select referral.athlete_id
  from public.coach_client_referrals as referral
  where referral.coach_id = p_coach_id
    and referral.status = 'confirmed'
    and referral.athlete_id is not null;
$$;

create or replace function public.get_athlete_home()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_athlete uuid := public.current_athlete_id();
  v_next record;
begin
  if v_athlete is null then
    return null;
  end if;

  select occ.id, occ.occurrence_date, occ.start_time, occ.end_time, occ.session_type, occ.session_name,
         occ.pillar_slot, coalesce(occ.place, occ.location) as place, coach.name as coach_name, booking.status
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
      'title', case when v_next.session_type = 'group' then coalesce(v_next.session_name, 'Group session')
                    else coalesce(v_next.pillar_slot, '1-on-1') end,
      'place', v_next.place,
      'coach_name', v_next.coach_name,
      'status', v_next.status
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
      where coach.id in (
        select b.coach_id from public.coach_slot_bookings as b
        where b.athlete_id = v_athlete and b.status in ('pending_payment', 'booked', 'completed', 'no_show')
        union
        select r.coach_id from public.coach_client_referrals as r
        where r.athlete_id = v_athlete and r.status = 'confirmed'
      )
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_athlete_home() from public, anon;
grant execute on function public.get_athlete_home() to authenticated;

-- Requests carry the preview a coach sees before accepting: age group comes from the birth date.
drop function if exists public.get_coach_booking_requests();
create function public.get_coach_booking_requests()
returns table(
  booking_id uuid, occurrence_id uuid, athlete_id uuid, athlete_name text, athlete_photo text,
  session_name text, session_type text, location text, place text, price numeric,
  occurrence_date date, start_time time, end_time time, notes text,
  requested_at timestamptz, expires_at timestamptz, capacity integer, taken integer,
  athlete_position text, athlete_birth_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
begin
  if v_coach_id is null then
    return;
  end if;

  perform public.expire_booking_requests(v_coach_id);

  return query
  select
    booking.id, occ.id, booking.athlete_id, athlete.full_name, athlete.profile_image_url,
    occ.session_name, occ.session_type::text, occ.location::text, occ.place, occ.price,
    occ.occurrence_date, occ.start_time, occ.end_time, booking.notes,
    booking.created_at, booking.expires_at,
    coalesce(occ.max_bookings_per_slot, 1),
    (select count(*)::integer from public.coach_slot_bookings as other
      where other.occurrence_id = occ.id and other.status in ('pending_payment', 'booked', 'completed')),
    athlete.position, athlete.date_of_birth
  from public.coach_slot_bookings as booking
  join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
  left join public.athlete_profiles as athlete on athlete.id = booking.athlete_id
  where booking.coach_id = v_coach_id
    and booking.status = 'requested'
  order by booking.expires_at, occ.occurrence_date, occ.start_time;
end;
$$;

revoke all on function public.get_coach_booking_requests() from public, anon;
grant execute on function public.get_coach_booking_requests() to authenticated;

-- get_coach_athlete: adds the season goal and highlight video.
create or replace function public.get_coach_athlete(p_athlete_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach uuid := public.current_coach_id();
  v_row jsonb;
begin
  if v_coach is null then
    raise exception 'Only coaches can see their athletes' using errcode = '42501';
  end if;
  if p_athlete_id is null or p_athlete_id not in (select public.coach_roster_ids(v_coach)) then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;

  select value into v_row
  from jsonb_array_elements(public.get_coach_roster()) as value
  where value->>'id' = p_athlete_id::text;

  return jsonb_build_object(
    'athlete', v_row,
    'goal', (select nullif(trim(athlete.season_goal), '') from public.athlete_profiles as athlete where athlete.id = p_athlete_id),
    'video', (select nullif(trim(athlete.highlight_video_url), '') from public.athlete_profiles as athlete where athlete.id = p_athlete_id),
    'note', coalesce((
      select note.private_note from public.coach_athlete_notes as note
      where note.coach_id = v_coach and note.athlete_id = p_athlete_id
    ), ''),
    'upcoming', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', occ.id,
        'date', occ.occurrence_date,
        'startTime', occ.start_time,
        'endTime', occ.end_time,
        'name', case when occ.session_type = 'group' then occ.session_name else coalesce(occ.pillar_slot, '1-on-1') end,
        'pillar', occ.pillar_slot,
        'kind', occ.session_type,
        'place', coalesce(occ.place, occ.location),
        'price', occ.price,
        'status', booking.status
      ) order by occ.occurrence_date, occ.start_time)
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
      where booking.coach_id = v_coach and booking.athlete_id = p_athlete_id
        and booking.status in ('booked', 'pending_payment', 'requested')
        and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
    ), '[]'::jsonb),
    'past', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', occ.id,
        'date', occ.occurrence_date,
        'startTime', occ.start_time,
        'endTime', occ.end_time,
        'name', case when occ.session_type = 'group' then occ.session_name else coalesce(occ.pillar_slot, '1-on-1') end,
        'pillar', occ.pillar_slot,
        'kind', occ.session_type,
        'place', coalesce(occ.place, occ.location),
        'price', occ.price,
        'status', booking.status,
        'hasFeedback', feedback.id is not null,
        'noShow', coalesce(feedback.no_show, false) or attendance.attendance in ('absent', 'no_show'),
        'summary', case when coalesce(feedback.no_show, false) then null else feedback.summary end,
        'note', note.feedback_to_athlete
      ) order by occ.occurrence_date desc, occ.start_time desc)
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
      left join public.session_feedback_v2 as feedback on feedback.slot_id = occ.id
      left join public.slot_attendance_v2 as attendance on attendance.booking_id = booking.id
      left join public.slot_feedback_v2 as note on note.booking_id = booking.id
      where booking.coach_id = v_coach and booking.athlete_id = p_athlete_id
        and booking.status in ('pending_payment', 'booked', 'completed', 'no_show')
        and public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
    ), '[]'::jsonb)
  );
end;
$function$;
