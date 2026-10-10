-- Working Copy: the coach's session page.
-- * Sessions the coach cancels keep when, why and what the families got back, for the
--   "Cancelled by you on ..." line.
-- get_coach_session: adds per athlete the parent's name, age, credits left, amount paid, the
--   athlete note and what came back on a cancelled booking; the coach's cancellation; and
--   the focus from the previous session for an upcoming 1-on-1.
-- coach_cancel_session: cancels with a reason, paid sessions included. A paid booking becomes
--   a session credit with the coach (like cancel_my_booking with notice); a credit booking gets
--   its credit back. Each family gets a message.
-- coach_move_session: moves a session into one of the coach's open slots (the open slot is
--   replaced) and messages each family.
-- coach_decline_note: keeps the reason on a request the coach just declined and sends the
--   family the coach's message.

alter table public.coach_availability_slot_occurrences
  add column if not exists canceled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists cancel_refund text;

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
  v_starts timestamptz;
  v_first_athlete uuid;
begin
  select * into v_occ from public.coach_availability_slot_occurrences where id = p_occurrence_id and coach_id = v_coach;
  if v_occ.id is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  v_starts := public.eastern_timestamp(v_occ.occurrence_date, v_occ.start_time);

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
    'started', v_starts <= now(),
    'ended', public.eastern_timestamp(v_occ.occurrence_date, v_occ.end_time) <= now(),
    'cancel', case
      when v_occ.canceled_at is not null then jsonb_build_object(
        'at', v_occ.canceled_at, 'reason', v_occ.cancel_reason, 'refund', v_occ.cancel_refund)
      when not v_occ.is_enabled then (
        select jsonb_build_object('at', max(b.canceled_at), 'reason', null, 'refund', null)
        from public.coach_slot_bookings b
        where b.occurrence_id = v_occ.id and b.cancellation_reason like 'Cancelled by coach%'
        having count(*) > 0
      )
    end,
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
        'cancellation_reason', booking.cancellation_reason,
        'canceled_at', booking.canceled_at,
        'age', extract(year from age((now() at time zone 'America/New_York')::date, athlete.date_of_birth))::int,
        'parent_name', (
          select up.name from public.user_profiles up
          where (up.athlete_id = athlete.id or up.id = athlete.user_id)
            and up.persona_type = 'parent' and coalesce(up.name, '') <> '' and up.name <> athlete.full_name
          limit 1
        ),
        'credits_left', public.coach_credits_left(v_coach, booking.athlete_id),
        'paid_amount', (select sum(p.total_amount) from public.payments p where p.booking_id = booking.id),
        'note', (select nullif(n.feedback_to_athlete, '') from public.slot_feedback_v2 n where n.booking_id = booking.id),
        -- A cancelled paid or credit booking came back as a credit (coach cancel, or 24 hours' notice).
        'credit_back', booking.status = 'canceled' and booking.payment_status in ('paid', 'credit') and (
          booking.cancellation_reason like 'Cancelled by coach%'
          or exists (select 1 from public.package_purchases pp where pp.source_booking_id = booking.id)
          or booking.canceled_at <= v_starts - interval '24 hours'
        )
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
    ) end,
    -- What to work on next: the note for the athlete from the previous session, else its summary.
    'last_focus', case when v_occ.session_type = 'individual' and v_first_athlete is not null then (
      select jsonb_build_object('date', prev.occurrence_date, 'text', coalesce(nullif(note.feedback_to_athlete, ''), feedback.summary))
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as prev on prev.id = booking.occurrence_id
      left join public.session_feedback_v2 as feedback on feedback.slot_id = prev.id and not feedback.no_show
      left join public.slot_feedback_v2 as note on note.booking_id = booking.id
      where booking.coach_id = v_coach and booking.athlete_id = v_first_athlete
        and prev.id <> v_occ.id
        and coalesce(nullif(note.feedback_to_athlete, ''), feedback.summary) is not null
        and (prev.occurrence_date, prev.start_time) < (v_occ.occurrence_date, v_occ.start_time)
      order by prev.occurrence_date desc, prev.start_time desc
      limit 1
    ) end
  );
end;
$$;

revoke all on function public.get_coach_session(uuid) from public, anon;
grant execute on function public.get_coach_session(uuid) to authenticated;

-- Cancels a session the coach owns, up to its end. Returns { sent, credits }.
create or replace function public.coach_cancel_session(p_occurrence_id uuid, p_reason text, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_occ public.coach_availability_slot_occurrences;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_booking public.coach_slot_bookings%rowtype;
  v_user uuid;
  v_credits integer := 0;
  v_returned integer := 0;
  v_sent integer;
  v_when text;
begin
  if v_reason is null then
    raise exception 'Choose a reason' using errcode = '22023';
  end if;
  select * into v_occ from public.coach_availability_slot_occurrences
  where id = p_occurrence_id and coach_id = v_coach and is_enabled
  for update;
  if v_occ.id is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  if public.eastern_timestamp(v_occ.occurrence_date, v_occ.end_time) <= now() then
    raise exception 'This session has already ended' using errcode = '22023';
  end if;

  v_when := to_char(v_occ.occurrence_date, 'Dy, Mon FMDD') || ' at ' || to_char(v_occ.start_time, 'FMHH12:MI am');
  v_sent := public.message_session_families(
    v_occ.id,
    coalesce(
      nullif(btrim(coalesce(p_message, '')), ''),
      'I had to cancel our session on ' || v_when || ' (' || v_reason || '). If it was paid, it comes back as a session credit with me.'
    )
  );

  for v_booking in
    select * from public.coach_slot_bookings
    where occurrence_id = v_occ.id and status in ('requested', 'pending_payment', 'booked')
    for update
  loop
    if v_booking.status = 'booked' and v_booking.payment_status in ('paid', 'credit') then
      if v_booking.payment_status = 'credit' and exists (
        select 1 from public.package_purchases
        where id = v_booking.credit_purchase_id and status = 'active' and (expiry_date is null or expiry_date > now())
      ) then
        update public.package_purchases set sessions_remaining = least(sessions_total, sessions_remaining + 1), updated_at = now()
        where id = v_booking.credit_purchase_id;
        v_returned := v_returned + 1;
      else
        select user_id into v_user from public.athlete_profiles where id = v_booking.athlete_id;
        insert into public.package_purchases (
          coach_id, user_id, package_id, source, source_booking_id, sessions_total, sessions_remaining,
          status, purchase_date, expiry_date, total_amount
        ) values (
          v_coach, v_user, null, 'cancel_credit', v_booking.id, 1, 1,
          'active', now(), now() + interval '90 days', 0
        );
      end if;
      v_credits := v_credits + 1;
    end if;
    update public.coach_slot_bookings
      set status = 'canceled', canceled_at = now(), updated_at = now(),
          cancellation_reason = 'Cancelled by coach. ' || v_reason
      where id = v_booking.id;
  end loop;

  update public.coach_availability_slot_occurrences
    set is_enabled = false, disabled_reason = 'removed', canceled_at = now(), cancel_reason = v_reason,
        cancel_refund = case
          when v_credits = 0 then 'Nothing was charged'
          when v_occ.session_type = 'group' then case when v_credits = 1 then 'The family who paid got a session credit' else 'Each family who paid got a session credit' end
          when v_returned > 0 then 'The package credit went back'
          else 'The family got a session credit'
        end
    where id = v_occ.id;
  return jsonb_build_object('sent', v_sent, 'credits', v_credits);
end;
$$;

revoke all on function public.coach_cancel_session(uuid, text, text) from public, anon;
grant execute on function public.coach_cancel_session(uuid, text, text) to authenticated;

-- Moves a session (up to its end) to an Eastern date and time. Open slots there are replaced;
-- anything booked there blocks the move. Returns how many families were told.
create or replace function public.coach_move_session(p_occurrence_id uuid, p_date date, p_start time, p_message text default null)
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
  if public.eastern_timestamp(v_occ.occurrence_date, v_occ.end_time) <= now() then
    raise exception 'This session has already ended' using errcode = '22023';
  end if;
  if extract(epoch from p_start) / 60 + v_occ.duration_minutes > 24 * 60 then
    raise exception 'Sessions must end before midnight' using errcode = '22023';
  end if;
  if public.eastern_timestamp(p_date, p_start) <= now() then
    raise exception 'Pick a time that hasn''t passed' using errcode = '22023';
  end if;
  v_end := p_start + make_interval(mins => v_occ.duration_minutes);

  if exists (
    select 1 from public.coach_availability_slot_occurrences as other
    where other.coach_id = v_coach and other.id <> v_occ.id and other.is_enabled
      and other.occurrence_date = p_date and other.start_time < v_end and p_start < other.end_time
      and (other.session_type = 'group' or other.is_draft or exists (
        select 1 from public.coach_slot_bookings b
        where b.occurrence_id = other.id and b.status in ('requested', 'pending_payment', 'booked', 'completed', 'no_show')
      ))
  ) then
    raise exception 'You already have something at that time' using errcode = '22023';
  end if;

  -- The open slots at the new time are taken by this session.
  update public.coach_availability_slot_occurrences as other
    set is_enabled = false, disabled_reason = 'replaced'
    where other.coach_id = v_coach and other.id <> v_occ.id and other.is_enabled
      and other.occurrence_date = p_date and other.start_time < v_end and p_start < other.end_time;

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
    coalesce(
      nullif(btrim(coalesce(p_message, '')), ''),
      'I moved our session to ' || to_char(p_date, 'Dy, Mon FMDD') || ' at ' || to_char(p_start, 'FMHH12:MI am') || '. Payment stays the same.'
    )
  );
end;
$$;

revoke all on function public.coach_move_session(uuid, date, time, text) from public, anon;
grant execute on function public.coach_move_session(uuid, date, time, text) to authenticated;

-- After a decline (respond_to_booking_request): keeps the reason and sends the coach's message.
create or replace function public.coach_decline_note(p_booking_id uuid, p_reason text, p_message text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_booking public.coach_slot_bookings%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_body text := nullif(btrim(coalesce(p_message, '')), '');
  v_conversation_id uuid;
begin
  select * into v_booking from public.coach_slot_bookings
  where id = p_booking_id and coach_id = v_coach and status = 'canceled' and cancellation_reason like 'Declined by coach%'
  for update;
  if v_booking.id is null then
    raise exception 'Request not found' using errcode = '42501';
  end if;
  if v_reason is not null then
    update public.coach_slot_bookings set cancellation_reason = 'Declined by coach. ' || v_reason, updated_at = now()
    where id = v_booking.id;
  end if;
  if v_body is not null and exists (select 1 from public.athlete_profiles where id = v_booking.athlete_id and user_id is not null) then
    v_conversation_id := public.open_family_conversation(v_booking.athlete_id);
    insert into public.messages (conversation_id, sender_id, body) values (v_conversation_id, auth.uid(), v_body);
    update public.conversations set last_message_at = now(), last_message_text = left(v_body, 200) where id = v_conversation_id;
  end if;
end;
$$;

revoke all on function public.coach_decline_note(uuid, text, text) from public, anon;
grant execute on function public.coach_decline_note(uuid, text, text) to authenticated;
