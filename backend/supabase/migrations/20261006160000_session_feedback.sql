-- ATH-82: the simplest session feedback.
-- One screen: who came, a 1 to 10 session score only the coach sees, and one summary for
-- every family who came. A no-show (1-on-1 athlete absent, or every group athlete absent)
-- skips the score and summary; the session stays charged. Notes for single athletes are
-- added afterwards and go only to that family.
-- The score lives in session_scores (coach only) because session_feedback_v2 is readable by
-- every signed-in user. Booking statuses don't change: attendance is in slot_attendance_v2.
-- Unpaid bookings (accepted requests, walk-ins added on the day) count as on the session.

create table if not exists public.session_scores (
  slot_id uuid primary key references public.coach_availability_slot_occurrences(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  score smallint not null check (score between 1 and 10),
  updated_at timestamptz not null default now()
);

alter table public.session_scores enable row level security;
revoke all on table public.session_scores from anon, authenticated;

drop policy if exists "Coaches read their session scores" on public.session_scores;
create policy "Coaches read their session scores" on public.session_scores
  for select to authenticated using (coach_id = public.current_coach_id());
grant select on table public.session_scores to authenticated;

alter table public.session_feedback_v2
  alter column rating drop not null,
  add column if not exists no_show boolean not null default false;

comment on column public.session_feedback_v2.rating is
  'Legacy 1 to 5 rating from before ATH-82. New feedback stores a 1 to 10 score in session_scores.';
comment on column public.session_feedback_v2.summary is
  'ATH-82: the summary every family who came sees, or the optional message for a no-show.';

-- What the feedback screen needs for one session the coach owns.
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

-- Saves attendance and feedback in one go. Athletes not in p_absent came. When nobody came
-- it's a no-show: no score, and p_summary is the optional message to the family.
-- Feedback can be edited once after it is first sent, like before.
create or replace function public.submit_session_feedback(
  p_slot_id uuid,
  p_absent uuid[],
  p_score integer,
  p_summary text
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
  end if;

  return jsonb_build_object('no_show', v_no_show, 'present', v_present);
end;
$$;

revoke all on function public.submit_session_feedback(uuid, uuid[], integer, text) from public, anon;
grant execute on function public.submit_session_feedback(uuid, uuid[], integer, text) to authenticated;

-- A note for one athlete who came. Only that family sees it.
create or replace function public.set_session_note(p_booking_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.coach_slot_bookings;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into v_booking from public.coach_slot_bookings
  where id = p_booking_id and coach_id = public.current_coach_id();
  if v_booking.id is null then
    raise exception 'Booking not found' using errcode = '42501';
  end if;
  if char_length(coalesce(v_note, '')) > 2000 then
    raise exception 'Keep the note under 2,000 characters' using errcode = '22023';
  end if;

  insert into public.slot_feedback_v2 (booking_id, slot_id, athlete_id, coach_id, feedback_to_athlete, status, created_by, updated_at)
    values (v_booking.id, v_booking.occurrence_id, v_booking.athlete_id, v_booking.coach_id, v_note, 'submitted', auth.uid(), now())
    on conflict (booking_id) do update
      set feedback_to_athlete = excluded.feedback_to_athlete, coach_id = excluded.coach_id, updated_at = now();
end;
$$;

revoke all on function public.set_session_note(uuid, text) from public, anon;
grant execute on function public.set_session_note(uuid, text) to authenticated;
