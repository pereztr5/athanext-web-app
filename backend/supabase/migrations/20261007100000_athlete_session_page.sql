-- ATH-97: the athlete's session page, and families never see other athletes' names in groups.
-- get_athlete_session: what the athlete's page shows for one of their sessions.
-- get_session_roster: coaches still get the full list; families get only their own entry.
--   The page shows a spot count instead.

create or replace function public.get_athlete_session(p_occurrence_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_athlete uuid := public.current_athlete_id();
  v_occ public.coach_availability_slot_occurrences;
  v_booking public.coach_slot_bookings;
begin
  if v_athlete is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  select * into v_booking from public.coach_slot_bookings
  where occurrence_id = p_occurrence_id and athlete_id = v_athlete
  order by case when status = 'canceled' then 1 else 0 end, created_at desc
  limit 1;
  if v_booking.id is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  select * into v_occ from public.coach_availability_slot_occurrences where id = p_occurrence_id;

  return jsonb_build_object(
    'id', v_occ.id,
    'date', v_occ.occurrence_date,
    'start_time', v_occ.start_time,
    'end_time', v_occ.end_time,
    'duration_minutes', v_occ.duration_minutes,
    'session_type', v_occ.session_type,
    'session_name', v_occ.session_name,
    'pillar', v_occ.pillar_slot,
    'price', v_occ.price,
    'location', v_occ.location,
    'place', v_occ.place,
    'started', public.eastern_timestamp(v_occ.occurrence_date, v_occ.start_time) <= now(),
    'ended', public.eastern_timestamp(v_occ.occurrence_date, v_occ.end_time) <= now(),
    'capacity', coalesce(v_occ.max_bookings_per_slot, 1),
    'taken', (select count(*) from public.coach_slot_bookings as b
              where b.occurrence_id = v_occ.id and b.status in ('pending_payment', 'booked', 'completed', 'no_show')),
    'coach', (select jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'photo', coalesce(c.profile_image_url, c.image_url))
              from public.coaches as c where c.id = v_occ.coach_id),
    'booking', jsonb_build_object(
      'id', v_booking.id,
      'status', v_booking.status,
      'payment_status', v_booking.payment_status,
      'paid_amount', (select sum(p.total_amount) from public.payments as p where p.booking_id = v_booking.id),
      'cancellation_reason', v_booking.cancellation_reason,
      'expires_at', v_booking.expires_at
    ),
    'attendance', (select a.attendance from public.slot_attendance_v2 as a where a.booking_id = v_booking.id),
    'summary', (select f.summary from public.session_feedback_v2 as f where f.slot_id = v_occ.id and not f.no_show),
    'note', (select nullif(n.feedback_to_athlete, '') from public.slot_feedback_v2 as n where n.booking_id = v_booking.id)
  );
end;
$$;

revoke all on function public.get_athlete_session(uuid) from public, anon;
grant execute on function public.get_athlete_session(uuid) to authenticated;

create or replace function public.get_session_roster(p_occurrence_id uuid)
returns table(display_name text, is_you boolean)
language plpgsql
stable security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_is_coach boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in to see who''s coming' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.user_profiles profile
    where profile.id = auth.uid() and profile.coach_id = occ.coach_id
  ) into v_is_coach
  from public.coach_availability_slot_occurrences occ
  where occ.id = p_occurrence_id;
  if v_is_coach is null then
    raise exception 'Session not found' using errcode = '22023';
  end if;

  return query
  select roster.display_name, roster.is_you
  from (
    select
      coalesce(nullif(btrim(ap.full_name), ''), 'Athlete') as display_name,
      coalesce(ap.user_id = auth.uid()
        or ap.id = (select profile.athlete_id from public.user_profiles profile where profile.id = auth.uid()), false) as is_you
    from (
      select distinct b.athlete_id
      from public.coach_slot_bookings b
      where b.occurrence_id = p_occurrence_id and b.status in ('booked', 'completed')
    ) booked
    left join public.athlete_profiles ap on ap.id = booked.athlete_id
  ) roster
  -- Families only ever get their own row (ATH-97); coaches get everyone.
  where v_is_coach or roster.is_you
  order by roster.is_you desc, lower(roster.display_name);
end;
$$;
