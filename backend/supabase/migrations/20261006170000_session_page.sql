-- ATH-80: the coach's page for one session.
-- get_coach_session: everything the page shows (when, where, who with payment and
--   attendance, feedback with the coach-only score, last summary for a 1-on-1 athlete).
-- schedule_reschedule_session: moves a session the coach owns to a new date and time and
--   messages each booked family.
-- schedule_cancel_session: cancels a session with no paid bookings and messages each family.
--   Paid sessions wait for in-app refunds (payments work).

create or replace function public.get_coach_session(p_occurrence_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_occ public.coach_availability_slot_occurrences;
  v_first_athlete uuid;
begin
  select * into v_occ from public.coach_availability_slot_occurrences where id = p_occurrence_id and coach_id = v_coach;
  if v_occ.id is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;

  select booking.athlete_id into v_first_athlete
  from public.coach_slot_bookings as booking
  where booking.occurrence_id = v_occ.id and booking.status in ('requested', 'pending_payment', 'booked', 'completed', 'no_show')
  order by booking.created_at limit 1;

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
    'capacity', v_occ.max_bookings_per_slot,
    'location', v_occ.location,
    'place', v_occ.place,
    'is_enabled', v_occ.is_enabled,
    'series_id', v_occ.series_id,
    'started', public.eastern_timestamp(v_occ.occurrence_date, v_occ.start_time) <= now(),
    'ended', public.eastern_timestamp(v_occ.occurrence_date, v_occ.end_time) <= now(),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', booking.id,
        'athlete_id', booking.athlete_id,
        'name', coalesce(athlete.full_name, 'Athlete'),
        'image_url', athlete.profile_image_url,
        'status', booking.status,
        'payment_status', booking.payment_status,
        'attendance', attendance.attendance,
        'notes', booking.notes,
        'cancellation_reason', booking.cancellation_reason
      ) order by booking.created_at)
      from public.coach_slot_bookings as booking
      left join public.athlete_profiles as athlete on athlete.id = booking.athlete_id
      left join public.slot_attendance_v2 as attendance on attendance.booking_id = booking.id
      where booking.occurrence_id = v_occ.id
        and booking.status in ('requested', 'pending_payment', 'booked', 'completed', 'no_show', 'canceled')
    ), '[]'::jsonb),
    'feedback', (
      select jsonb_build_object(
        'summary', feedback.summary,
        'no_show', feedback.no_show,
        'edit_count', feedback.edit_count,
        'score', (select score.score from public.session_scores as score where score.slot_id = v_occ.id)
      )
      from public.session_feedback_v2 as feedback where feedback.slot_id = v_occ.id
    ),
    'last_summary', case when v_occ.session_type = 'individual' and v_first_athlete is not null then (
      select jsonb_build_object('date', prev.occurrence_date, 'summary', feedback.summary)
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as prev on prev.id = booking.occurrence_id
      join public.session_feedback_v2 as feedback on feedback.slot_id = prev.id
      where booking.coach_id = v_coach and booking.athlete_id = v_first_athlete
        and prev.id <> v_occ.id and not feedback.no_show and feedback.summary is not null
        and (prev.occurrence_date, prev.start_time) < (v_occ.occurrence_date, v_occ.start_time)
      order by prev.occurrence_date desc, prev.start_time desc
      limit 1
    ) end
  );
end;
$$;

revoke all on function public.get_coach_session(uuid) from public, anon;
grant execute on function public.get_coach_session(uuid) to authenticated;

-- Posts p_body to each family booked on the session, in their direct conversation with the coach.
create or replace function public.message_session_families(p_occurrence_id uuid, p_body text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_athlete record;
  v_conversation_id uuid;
  v_sent integer := 0;
begin
  for v_athlete in
    select distinct athlete.user_id, athlete.full_name
    from public.coach_slot_bookings as booking
    join public.athlete_profiles as athlete on athlete.id = booking.athlete_id
    where booking.occurrence_id = p_occurrence_id
      and booking.status in ('requested', 'pending_payment', 'booked')
      and athlete.user_id is not null and athlete.user_id <> v_me
  loop
    select conversation.id into v_conversation_id
    from public.conversations as conversation
    where not coalesce(conversation.is_group, false) and conversation.owner_coach_id is null
      and exists (select 1 from public.conversation_participants p where p.conversation_id = conversation.id and p.user_id = v_me)
      and exists (select 1 from public.conversation_participants p where p.conversation_id = conversation.id and p.user_id = v_athlete.user_id)
    order by conversation.last_message_at desc nulls last
    limit 1;
    if v_conversation_id is null then
      insert into public.conversations (created_by, is_group, title) values (v_me, false, v_athlete.full_name)
        returning id into v_conversation_id;
      insert into public.conversation_participants (conversation_id, user_id, role)
        values (v_conversation_id, v_me, 'owner'), (v_conversation_id, v_athlete.user_id, 'member');
    end if;
    insert into public.messages (conversation_id, sender_id, body) values (v_conversation_id, v_me, p_body);
    update public.conversations set last_message_at = now(), last_message_text = left(p_body, 200) where id = v_conversation_id;
    v_sent := v_sent + 1;
    v_conversation_id := null;
  end loop;
  return v_sent;
end;
$$;

revoke all on function public.message_session_families(uuid, text) from public, anon, authenticated;

create or replace function public.schedule_reschedule_session(
  p_occurrence_id uuid,
  p_date date,
  p_start time,
  p_message text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_occ public.coach_availability_slot_occurrences;
  v_end time;
begin
  select * into v_occ from public.coach_availability_slot_occurrences
  where id = p_occurrence_id and coach_id = v_coach and is_enabled
  for update;
  if v_occ.id is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  if public.eastern_timestamp(v_occ.occurrence_date, v_occ.start_time) <= now() then
    raise exception 'This session has already started' using errcode = '22023';
  end if;
  v_end := p_start + make_interval(mins => v_occ.duration_minutes);
  if extract(epoch from p_start) / 60 + v_occ.duration_minutes > 24 * 60 then
    raise exception 'Sessions must end before midnight' using errcode = '22023';
  end if;
  if public.eastern_timestamp(p_date, p_start) <= now() then
    raise exception 'Pick a time that hasn''t passed' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.coach_availability_slot_occurrences as other
    where other.coach_id = v_coach and other.id <> v_occ.id and other.is_enabled
      and other.occurrence_date = p_date and other.start_time < v_end and p_start < other.end_time
  ) then
    raise exception 'You already have something at that time' using errcode = '22023';
  end if;

  update public.coach_availability_slot_occurrences
    set occurrence_date = p_date, start_time = p_start, end_time = v_end, series_id = null
    where id = v_occ.id;

  -- A moved week leaves its series, so the series doesn't fill the old date again.
  if v_occ.series_id is not null then
    insert into public.coach_availability_slot_occurrences (
      series_id, coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
      session_type, location, place, pillar_slot, position, visibility, offered_to, details,
      is_enabled, disabled_reason, max_bookings_per_slot
    ) values (
      v_occ.series_id, v_coach, v_occ.occurrence_date, v_occ.session_name, v_occ.price, v_occ.duration_minutes,
      v_occ.start_time, v_occ.end_time, v_occ.session_type, v_occ.location, v_occ.place, v_occ.pillar_slot,
      v_occ.position, v_occ.visibility, v_occ.offered_to, v_occ.details, false, 'removed', v_occ.max_bookings_per_slot
    );
  end if;

  return public.message_session_families(
    v_occ.id,
    coalesce(nullif(trim(p_message), ''), 'Your session has moved. Check My Sessions for the new time.')
  );
end;
$$;

revoke all on function public.schedule_reschedule_session(uuid, date, time, text) from public, anon;
grant execute on function public.schedule_reschedule_session(uuid, date, time, text) to authenticated;

create or replace function public.schedule_cancel_session(p_occurrence_id uuid, p_message text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_occ public.coach_availability_slot_occurrences;
  v_sent integer;
begin
  select * into v_occ from public.coach_availability_slot_occurrences
  where id = p_occurrence_id and coach_id = v_coach and is_enabled
  for update;
  if v_occ.id is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  if public.eastern_timestamp(v_occ.occurrence_date, v_occ.start_time) <= now() then
    raise exception 'This session has already started' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.coach_slot_bookings
    where occurrence_id = v_occ.id and payment_status = 'paid' and status in ('booked', 'completed')
  ) then
    raise exception 'A family has already paid for this session. Message them to move it instead; cancelling with a refund comes with in-app payments.'
      using errcode = '22023';
  end if;

  v_sent := public.message_session_families(
    v_occ.id,
    coalesce(nullif(trim(p_message), ''), 'Your session was cancelled. Nothing was charged.')
  );

  update public.coach_slot_bookings
    set status = 'canceled', canceled_at = now(), cancellation_reason = 'Cancelled by coach', updated_at = now()
    where occurrence_id = v_occ.id and status in ('requested', 'pending_payment', 'booked');
  update public.coach_availability_slot_occurrences
    set is_enabled = false, disabled_reason = 'removed'
    where id = v_occ.id;
  return v_sent;
end;
$$;

revoke all on function public.schedule_cancel_session(uuid, text) from public, anon;
grant execute on function public.schedule_cancel_session(uuid, text) to authenticated;
