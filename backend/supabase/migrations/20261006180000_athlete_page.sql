-- ATH-79: the coach's athlete page, simplified. Previous sessions carry their feedback (the
-- summary, a no-show, the note for this athlete) so the page can show a one-line summary and
-- Add feedback where it's due. Gear bought and total spent leave the athlete page; gear
-- purchases stay recorded in gear_purchases.

create or replace function public.get_coach_athlete(p_athlete_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.get_coach_athlete(uuid) from public, anon;
grant execute on function public.get_coach_athlete(uuid) to authenticated;
