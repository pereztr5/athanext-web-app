-- Feedback flow matching the Working Copy: the check-in screen shows a session card (place,
-- athlete age and position), notes for each athlete go out together with the summary, and
-- the feedback-due queue carries a title for "1 of N" and the "Next: …" toast.

-- Same as before, plus where the session is and each athlete's age and position.
create or replace function public.get_feedback_screen(p_slot_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
begin
  if not exists (
    select 1 from public.coach_availability_slot_occurrences where id = p_slot_id and coach_id = v_coach
  ) then
    raise exception 'Session not found' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'id', occ.id,
      'date', occ.occurrence_date,
      'start_time', occ.start_time,
      'end_time', occ.end_time,
      'session_name', occ.session_name,
      'session_type', occ.session_type,
      'pillar', occ.pillar_slot,
      'location', occ.location,
      'place', occ.place,
      'ended', public.eastern_timestamp(occ.occurrence_date, occ.end_time) <= now(),
      'started', public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now(),
      'summary', feedback.summary,
      'no_show', coalesce(feedback.no_show, false),
      'edit_count', coalesce(feedback.edit_count, 0),
      'submitted', feedback.id is not null,
      'score', (select score.score from public.session_scores as score where score.slot_id = occ.id),
      'athletes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'booking_id', booking.id,
          'athlete_id', booking.athlete_id,
          'name', coalesce(athlete.full_name, 'Athlete'),
          'image_url', athlete.profile_image_url,
          'age', case when athlete.date_of_birth is not null
            then date_part('year', age(occ.occurrence_date, athlete.date_of_birth))::int end,
          'position', nullif(trim(athlete.position), ''),
          'attendance', attendance.attendance,
          'note', note.feedback_to_athlete
        ) order by athlete.full_name)
        from public.coach_slot_bookings as booking
        left join public.athlete_profiles as athlete on athlete.id = booking.athlete_id
        left join public.slot_attendance_v2 as attendance on attendance.booking_id = booking.id
        left join public.slot_feedback_v2 as note on note.booking_id = booking.id
        where booking.occurrence_id = occ.id and booking.status in ('pending_payment', 'booked', 'completed', 'no_show')
      ), '[]'::jsonb)
    )
    from public.coach_availability_slot_occurrences as occ
    left join public.session_feedback_v2 as feedback on feedback.slot_id = occ.id
    where occ.id = p_slot_id
  );
end;
$$;

revoke all on function public.get_feedback_screen(uuid) from public, anon;
grant execute on function public.get_feedback_screen(uuid) to authenticated;

-- Same as before, plus p_notes: {booking_id: note} for athletes who came, saved in the same
-- transaction as the summary. An empty note clears that athlete's note. Bookings that are
-- absent or not on this session are ignored.
drop function if exists public.submit_session_feedback(uuid, uuid[], integer, text);

create or replace function public.submit_session_feedback(
  p_slot_id uuid,
  p_absent uuid[],
  p_score integer,
  p_summary text,
  p_notes jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_occ public.coach_availability_slot_occurrences;
  v_total integer;
  v_present integer;
  v_no_show boolean;
  v_edit_count integer;
  v_summary text := nullif(trim(coalesce(p_summary, '')), '');
  v_notes jsonb := case when jsonb_typeof(p_notes) = 'object' then p_notes else '{}'::jsonb end;
begin
  select * into v_occ from public.coach_availability_slot_occurrences where id = p_slot_id and coach_id = v_coach;
  if v_occ.id is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  if public.eastern_timestamp(v_occ.occurrence_date, v_occ.start_time) > now() then
    raise exception 'Feedback opens once the session starts' using errcode = '22023';
  end if;
  if char_length(coalesce(v_summary, '')) > 4000 then
    raise exception 'Keep the summary under 4,000 characters' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each_text(v_notes) as n where char_length(trim(coalesce(n.value, ''))) > 2000) then
    raise exception 'Keep each note under 2,000 characters' using errcode = '22023';
  end if;

  select count(*), count(*) filter (where not (booking.athlete_id = any(coalesce(p_absent, '{}'))))
    into v_total, v_present
  from public.coach_slot_bookings as booking
  where booking.occurrence_id = p_slot_id and booking.status in ('pending_payment', 'booked', 'completed', 'no_show');
  if v_total = 0 then
    raise exception 'Nobody was booked on this session' using errcode = '22023';
  end if;
  v_no_show := v_present = 0;
  if not v_no_show and (p_score is null or p_score not between 1 and 10) then
    raise exception 'Give the session a score from 1 to 10' using errcode = '22023';
  end if;

  select edit_count into v_edit_count from public.session_feedback_v2 where slot_id = p_slot_id for update;
  if v_edit_count is not null and v_edit_count >= 1 then
    raise exception 'Feedback can only be edited once' using errcode = '22023';
  end if;

  insert into public.slot_attendance_v2 (booking_id, slot_id, athlete_id, attendance, created_by, updated_at)
  select booking.id, p_slot_id, booking.athlete_id,
    case
      when not (booking.athlete_id = any(coalesce(p_absent, '{}'))) then 'present'::public.attendance_status
      when v_occ.session_type = 'individual' then 'no_show'::public.attendance_status
      else 'absent'::public.attendance_status
    end,
    auth.uid(), now()
  from public.coach_slot_bookings as booking
  where booking.occurrence_id = p_slot_id and booking.status in ('pending_payment', 'booked', 'completed', 'no_show')
  on conflict (booking_id) do update
    set attendance = excluded.attendance, updated_at = now();

  insert into public.session_feedback_v2 (slot_id, coach_id, rating, summary, status, no_show, created_by, edit_count, updated_at)
    values (p_slot_id, v_coach, null, v_summary, 'submitted', v_no_show, auth.uid(), 0, now())
    on conflict (slot_id) do update
      set summary = excluded.summary,
          no_show = excluded.no_show,
          edit_count = public.session_feedback_v2.edit_count + 1,
          updated_at = now();

  if v_no_show then
    delete from public.session_scores where slot_id = p_slot_id;
  else
    insert into public.session_scores (slot_id, coach_id, score, updated_at)
      values (p_slot_id, v_coach, p_score, now())
      on conflict (slot_id) do update set score = excluded.score, updated_at = now();

    insert into public.slot_feedback_v2 (booking_id, slot_id, athlete_id, coach_id, feedback_to_athlete, status, created_by, updated_at)
    select booking.id, p_slot_id, booking.athlete_id, v_coach, nullif(trim(n.value), ''), 'submitted', auth.uid(), now()
    from jsonb_each_text(v_notes) as n
    join public.coach_slot_bookings as booking on booking.id::text = n.key
    where booking.occurrence_id = p_slot_id
      and booking.status in ('pending_payment', 'booked', 'completed', 'no_show')
      and not (booking.athlete_id = any(coalesce(p_absent, '{}')))
    on conflict (booking_id) do update
      set feedback_to_athlete = excluded.feedback_to_athlete, coach_id = excluded.coach_id, updated_at = now();
  end if;

  return jsonb_build_object('no_show', v_no_show, 'present', v_present);
end;
$$;

revoke all on function public.submit_session_feedback(uuid, uuid[], integer, text, jsonb) from public, anon;
grant execute on function public.submit_session_feedback(uuid, uuid[], integer, text, jsonb) to authenticated;

-- Same rows as before, plus end_time and a title: the group's name, or the athlete on a 1-on-1.
create or replace function public.get_feedback_due()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', occ.id,
      'date', occ.occurrence_date,
      'start_time', occ.start_time,
      'end_time', occ.end_time,
      'session_name', occ.session_name,
      'session_type', occ.session_type,
      'title', case
        when occ.session_type = 'group' then occ.session_name
        else coalesce((
          select athlete.full_name
          from public.coach_slot_bookings as booking
          join public.athlete_profiles as athlete on athlete.id = booking.athlete_id
          where booking.occurrence_id = occ.id and booking.status in ('booked', 'completed')
          order by booking.created_at
          limit 1
        ), occ.session_name)
      end
    ) order by occ.occurrence_date desc, occ.start_time desc), '[]'::jsonb)
  from public.coach_availability_slot_occurrences as occ
  where occ.coach_id = public.current_coach_id()
    and occ.is_enabled
    and public.eastern_timestamp(occ.occurrence_date, occ.end_time) <= now()
    and occ.occurrence_date >= (timezone('America/New_York', now()))::date - 14
    and exists (
      select 1 from public.coach_slot_bookings as booking
      where booking.occurrence_id = occ.id and booking.status in ('booked', 'completed')
    )
    and not exists (
      select 1 from public.session_feedback_v2 as feedback
      where feedback.slot_id = occ.id
    );
$$;

revoke all on function public.get_feedback_due() from public, anon;
grant execute on function public.get_feedback_due() to authenticated;
