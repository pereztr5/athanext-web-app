-- Family reschedule (Working Copy session page).
-- A coach move relocates the occurrence. A family move keeps payment on the same
-- booking and points it at another open occurrence of the same coach: same session
-- type, same duration, same price, with room, and only while the original start is
-- still outside the coach's cancellation window. The coach is told in the existing
-- direct thread (the notifications bell reads that message). Not applied yet.

create or replace function public.reschedule_my_booking(
  p_booking_id uuid,
  p_new_occurrence_id uuid,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.coach_slot_bookings%rowtype;
  v_old public.coach_availability_slot_occurrences%rowtype;
  v_new public.coach_availability_slot_occurrences%rowtype;
  v_starts timestamptz;
  v_notice integer;
  v_taken integer;
  v_coach_user uuid;
  v_coach_name text;
  v_athlete_name text;
  v_conversation_id uuid;
  v_note text;
  v_body text;
  v_notified boolean := false;
begin
  if auth.uid() is null or p_booking_id is null or p_new_occurrence_id is null then
    raise exception 'Booking not found' using errcode = '42501';
  end if;

  -- Same order in every call, so two families cannot pass the capacity check together.
  perform pg_advisory_xact_lock(hashtext('reschedule-booking:' || p_booking_id::text));
  perform pg_advisory_xact_lock(hashtext('reschedule-slot:' || p_new_occurrence_id::text));

  select * into v_booking
  from public.coach_slot_bookings
  where id = p_booking_id
  for update;
  if not found then
    raise exception 'Booking not found' using errcode = '42501';
  end if;

  if not (
    v_booking.athlete_id = public.current_athlete_id()
    or v_booking.created_by = auth.uid()
    or exists (
      select 1 from public.athlete_profiles as athlete
      where athlete.id = v_booking.athlete_id and athlete.user_id = auth.uid()
    )
  ) then
    raise exception 'Booking not found' using errcode = '42501';
  end if;

  if v_booking.status <> 'booked'
     or v_booking.payment_status not in ('paid', 'credit', 'direct', 'outside') then
    raise exception 'Only a paid upcoming session can be rescheduled' using errcode = '22023';
  end if;

  if p_new_occurrence_id = v_booking.occurrence_id then
    raise exception 'Pick a different time' using errcode = '22023';
  end if;

  if v_booking.occurrence_id < p_new_occurrence_id then
    select * into v_old from public.coach_availability_slot_occurrences where id = v_booking.occurrence_id for update;
    select * into v_new from public.coach_availability_slot_occurrences where id = p_new_occurrence_id for update;
  else
    select * into v_new from public.coach_availability_slot_occurrences where id = p_new_occurrence_id for update;
    select * into v_old from public.coach_availability_slot_occurrences where id = v_booking.occurrence_id for update;
  end if;

  if v_old.id is null then
    raise exception 'This session can no longer be rescheduled' using errcode = '22023';
  end if;

  v_starts := public.eastern_timestamp(v_old.occurrence_date, v_old.start_time);
  if v_starts <= now() then
    raise exception 'This session has already started' using errcode = '22023';
  end if;

  select greatest(1, least(coalesce(c.cancel_notice_hours, 24), 168)) into v_notice
  from public.coaches as c
  where c.id = v_booking.coach_id;
  v_notice := coalesce(v_notice, 24);

  if v_starts <= now() + make_interval(hours => v_notice) then
    raise exception 'This is inside the cancellation window, so it can''t be moved' using errcode = '22023';
  end if;

  if v_new.id is null or v_new.coach_id is distinct from v_booking.coach_id then
    raise exception 'That time isn''t open' using errcode = '22023';
  end if;

  if v_new.session_type is distinct from v_old.session_type
     or v_new.duration_minutes is distinct from v_old.duration_minutes then
    raise exception 'Pick a time with the same session type and length' using errcode = '22023';
  end if;

  if v_new.price is distinct from v_old.price then
    raise exception 'That time has a different price' using errcode = '22023';
  end if;

  if not v_new.is_enabled or coalesce(v_new.is_draft, false) then
    raise exception 'That time isn''t open' using errcode = '22023';
  end if;

  if public.eastern_timestamp(v_new.occurrence_date, v_new.start_time) <= now() then
    raise exception 'That time has already passed' using errcode = '22023';
  end if;

  -- Same open-slot rules the book page uses (visibility, busy times, drafts).
  if not exists (
    select 1
    from public.visible_sessions(
      v_booking.coach_id,
      v_booking.athlete_id,
      v_new.occurrence_date,
      v_new.occurrence_date
    ) as slot
    where slot.id = v_new.id
  ) then
    raise exception 'That time isn''t open' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.coach_slot_bookings as other
    where other.occurrence_id = v_new.id
      and other.athlete_id = v_booking.athlete_id
      and other.id <> v_booking.id
      and other.status in ('requested', 'pending_payment', 'booked', 'completed', 'no_show')
  ) then
    raise exception 'You already have this session' using errcode = '22023';
  end if;

  select count(*)::integer into v_taken
  from public.coach_slot_bookings as other
  where other.occurrence_id = v_new.id
    and other.id <> v_booking.id
    and other.status in ('requested', 'pending_payment', 'booked', 'completed');

  if v_taken >= coalesce(v_new.max_bookings_per_slot, 1) then
    raise exception 'That time was just taken. Pick another one.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.coach_slot_bookings as other
    join public.coach_availability_slot_occurrences as occ on occ.id = other.occurrence_id
    where other.athlete_id = v_booking.athlete_id
      and other.id <> v_booking.id
      and other.status in ('requested', 'pending_payment', 'booked')
      and occ.is_enabled
      and occ.occurrence_date = v_new.occurrence_date
      and occ.start_time < v_new.end_time
      and v_new.start_time < occ.end_time
  ) then
    raise exception 'You already have a session at that time' using errcode = '22023';
  end if;

  update public.coach_slot_bookings
  set occurrence_id = v_new.id,
      change_ask = null,
      change_from = null
  where id = v_booking.id;

  select athlete.full_name into v_athlete_name
  from public.athlete_profiles as athlete
  where athlete.id = v_booking.athlete_id;
  select coach.name into v_coach_name
  from public.coaches as coach
  where coach.id = v_booking.coach_id;
  select profile.id into v_coach_user
  from public.user_profiles as profile
  where profile.coach_id = v_booking.coach_id
    and profile.id is distinct from auth.uid()
  limit 1;

  if v_coach_user is not null then
    select conversation.id into v_conversation_id
    from public.conversations as conversation
    where not coalesce(conversation.is_group, false)
      and conversation.owner_coach_id is null
      and exists (
        select 1 from public.conversation_participants as participant
        where participant.conversation_id = conversation.id and participant.user_id = auth.uid()
      )
      and exists (
        select 1 from public.conversation_participants as participant
        where participant.conversation_id = conversation.id and participant.user_id = v_coach_user
      )
    order by conversation.last_message_at desc nulls last
    limit 1;

    if v_conversation_id is null then
      insert into public.conversations (created_by, is_group, title)
      values (auth.uid(), false, coalesce(v_coach_name, 'Coach'))
      returning id into v_conversation_id;
      insert into public.conversation_participants (conversation_id, user_id, role)
      values
        (v_conversation_id, auth.uid(), 'owner'),
        (v_conversation_id, v_coach_user, 'member');
    end if;

    v_note := nullif(left(btrim(coalesce(p_message, '')), 500), '');
    v_body := split_part(coalesce(nullif(btrim(v_athlete_name), ''), 'An athlete'), ' ', 1)
      || ' moved their session from '
      || to_char(v_old.occurrence_date, 'Dy, Mon FMDD')
      || ' at '
      || to_char(v_old.start_time, 'FMHH12:MI am')
      || ' to '
      || to_char(v_new.occurrence_date, 'Dy, Mon FMDD')
      || ' at '
      || to_char(v_new.start_time, 'FMHH12:MI am')
      || '. Payment stays the same.';
    if v_note is not null then
      v_body := v_body || ' ' || v_note;
    end if;

    insert into public.messages (conversation_id, sender_id, body)
    values (v_conversation_id, auth.uid(), left(v_body, 2000));
    update public.conversations
    set last_message_at = now(), last_message_text = left(v_body, 200)
    where id = v_conversation_id;
    v_notified := true;
  end if;

  return jsonb_build_object('occurrence_id', v_new.id, 'notified', v_notified);
end;
$$;

revoke all on function public.reschedule_my_booking(uuid, uuid, text) from public, anon;
grant execute on function public.reschedule_my_booking(uuid, uuid, text) to authenticated;

comment on function public.reschedule_my_booking(uuid, uuid, text) is
  'Moves the caller''s paid upcoming booking onto another open slot of the same coach, type, length and price, then messages the coach.';

-- So the session page can show the same window the RPC enforces. Live body, plus this one field.
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
    'cancel_notice_hours', coalesce((
      select greatest(1, least(coalesce(c.cancel_notice_hours, 24), 168))
      from public.coaches as c where c.id = v_occ.coach_id
    ), 24),
    'coach', (select jsonb_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'photo', coalesce(c.profile_image_url, c.image_url),
        'pay_mode', c.pay_mode, 'pay_note', c.pay_note)
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
