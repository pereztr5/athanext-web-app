-- ATH-85 leftovers.
-- 1. Requests show how full a group is, and Accept refuses a full group.
-- 2. Suggest another time: the coach offers a 1-on-1 at a new time to that family only. The
--    request closes, the family is messaged, and the offer waits in "Waiting for the family"
--    until they book it (instantly, since the coach chose it) or it passes.
-- 3. Accepted bookings can be added to the coach's Google Calendar: the connection records
--    whether Google granted event access, and the booking keeps the event id.

alter table public.coach_calendar_connections
  add column if not exists can_write boolean not null default false;
alter table public.coach_slot_bookings
  add column if not exists google_event_id text;

drop function if exists public.get_coach_booking_requests();
create function public.get_coach_booking_requests()
returns table(
  booking_id uuid, occurrence_id uuid, athlete_id uuid, athlete_name text, athlete_photo text,
  session_name text, session_type text, location text, place text, price numeric,
  occurrence_date date, start_time time, end_time time, notes text,
  requested_at timestamptz, expires_at timestamptz, capacity integer, taken integer
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
      where other.occurrence_id = occ.id and other.status in ('pending_payment', 'booked', 'completed'))
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

create or replace function public.respond_to_booking_request(p_booking_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
begin
  select booking.status::text as status, booking.expires_at, booking.occurrence_id,
         coalesce(occ.max_bookings_per_slot, 1) as capacity
    into v_booking
  from public.coach_slot_bookings as booking
  join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
  where booking.id = p_booking_id
    and booking.coach_id = public.current_coach_id()
  for update of booking;

  if v_booking.status is null then
    raise exception 'Booking request not found' using errcode = '42501';
  end if;
  if v_booking.status <> 'requested' then
    raise exception 'This request was already answered' using errcode = '22023';
  end if;
  if p_accept and v_booking.expires_at is not null and v_booking.expires_at <= now() then
    perform public.expire_booking_requests(public.current_coach_id());
    raise exception 'This request has expired, so it can no longer be accepted' using errcode = '22023';
  end if;
  if p_accept and (
    select count(*) from public.coach_slot_bookings
    where occurrence_id = v_booking.occurrence_id and status in ('pending_payment', 'booked', 'completed')
  ) >= v_booking.capacity then
    raise exception 'Group is full' using errcode = '22023';
  end if;

  if p_accept then
    update public.coach_slot_bookings
      set status = 'pending_payment', updated_at = now()
      where id = p_booking_id;
    return 'pending_payment';
  end if;

  update public.coach_slot_bookings
    set status = 'canceled',
        canceled_at = now(),
        cancellation_reason = 'Declined by coach',
        updated_at = now()
    where id = p_booking_id;
  return 'canceled';
end;
$$;

-- Offers a 1-on-1 at p_date p_start (Eastern) to the family who asked, closes their request
-- and messages them. Returns the new session's id.
create or replace function public.suggest_booking_time(
  p_booking_id uuid,
  p_date date,
  p_start time,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_booking public.coach_slot_bookings;
  v_occ public.coach_availability_slot_occurrences;
  v_end time;
  v_new uuid;
  v_when text;
begin
  select * into v_booking from public.coach_slot_bookings
  where id = p_booking_id and coach_id = v_coach
  for update;
  if v_booking.id is null then
    raise exception 'Booking request not found' using errcode = '42501';
  end if;
  if v_booking.status <> 'requested' then
    raise exception 'This request was already answered' using errcode = '22023';
  end if;
  select * into v_occ from public.coach_availability_slot_occurrences where id = v_booking.occurrence_id;
  if v_occ.session_type <> 'individual' then
    raise exception 'Suggest another time works for 1-on-1 requests' using errcode = '22023';
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
    where other.coach_id = v_coach and other.is_enabled
      -- The family's own requested time closes with the request; an open slot stays open.
      and (other.id <> v_occ.id or not (v_occ.details ? 'requested_time'))
      and other.occurrence_date = p_date and other.start_time < v_end and p_start < other.end_time
  ) then
    raise exception 'You already have something at that time' using errcode = '22023';
  end if;

  insert into public.coach_availability_slot_occurrences (
    coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
    session_type, location, place, pillar_slot, position, visibility, offered_to, details,
    is_enabled, max_bookings_per_slot
  ) values (
    v_coach, p_date, v_occ.session_name, v_occ.price, v_occ.duration_minutes, p_start, v_end,
    'individual', v_occ.location, v_occ.place, v_occ.pillar_slot, v_occ.position, 'offered',
    array[v_booking.athlete_id],
    coalesce(v_occ.details, '{}'::jsonb) - 'requested_time' || jsonb_build_object('suggested_for', v_booking.id),
    true, 1
  ) returning id into v_new;

  update public.coach_slot_bookings
    set status = 'canceled', canceled_at = now(), cancellation_reason = 'Coach suggested another time', updated_at = now()
    where id = v_booking.id;
  -- A request for a time the family typed in made its own session; close it with the request.
  if v_occ.details ? 'requested_time' then
    update public.coach_availability_slot_occurrences
      set is_enabled = false, disabled_reason = 'removed'
      where id = v_occ.id;
  end if;

  v_when := to_char(p_date, 'FMDay, Mon FMDD') || ' at ' || ltrim(to_char(p_start, 'FMHH12:MI AM'), '0');
  perform public.message_session_families_to(
    v_booking.athlete_id,
    coalesce(nullif(trim(p_message), ''), 'That time doesn''t work for me. How about ' || v_when || ' (Eastern)? Book it from My Sessions.')
  );
  return v_new;
end;
$$;

revoke all on function public.suggest_booking_time(uuid, date, time, text) from public, anon;
grant execute on function public.suggest_booking_time(uuid, date, time, text) to authenticated;

-- Direct message from the signed-in coach to one athlete's family.
create or replace function public.message_session_families_to(p_athlete_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_user uuid;
  v_name text;
  v_conversation_id uuid;
begin
  select user_id, full_name into v_user, v_name from public.athlete_profiles where id = p_athlete_id;
  if v_user is null or v_user = v_me then
    return;
  end if;
  select conversation.id into v_conversation_id
  from public.conversations as conversation
  where not coalesce(conversation.is_group, false) and conversation.owner_coach_id is null
    and exists (select 1 from public.conversation_participants p where p.conversation_id = conversation.id and p.user_id = v_me)
    and exists (select 1 from public.conversation_participants p where p.conversation_id = conversation.id and p.user_id = v_user)
  order by conversation.last_message_at desc nulls last
  limit 1;
  if v_conversation_id is null then
    insert into public.conversations (created_by, is_group, title) values (v_me, false, v_name)
      returning id into v_conversation_id;
    insert into public.conversation_participants (conversation_id, user_id, role)
      values (v_conversation_id, v_me, 'owner'), (v_conversation_id, v_user, 'member');
  end if;
  insert into public.messages (conversation_id, sender_id, body) values (v_conversation_id, v_me, p_body);
  update public.conversations set last_message_at = now(), last_message_text = left(p_body, 200) where id = v_conversation_id;
end;
$$;

revoke all on function public.message_session_families_to(uuid, text) from public, anon, authenticated;

-- Times the coach suggested that the family hasn't booked yet.
create or replace function public.get_waiting_suggestions()
returns table(
  occurrence_id uuid, athlete_id uuid, athlete_name text, occurrence_date date,
  start_time time, end_time time, price numeric, suggested_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select occ.id, athlete.id, coalesce(athlete.full_name, 'Athlete'), occ.occurrence_date,
         occ.start_time, occ.end_time, occ.price, occ.created_at
  from public.coach_availability_slot_occurrences as occ
  left join public.athlete_profiles as athlete on athlete.id = occ.offered_to[1]
  where occ.coach_id = public.current_coach_id()
    and occ.is_enabled
    and occ.details ? 'suggested_for'
    and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
    and not exists (
      select 1 from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
    )
  order by occ.occurrence_date, occ.start_time;
$$;

revoke all on function public.get_waiting_suggestions() from public, anon;
grant execute on function public.get_waiting_suggestions() to authenticated;

-- get_coach_schedule: the calendar object also says whether events can be written.
create or replace function public.get_coach_schedule(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach_id uuid := public.current_coach_id();
begin
  if v_coach_id is null then
    raise exception 'Only coaches have a schedule' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'Pick a range of up to 62 days' using errcode = '22023';
  end if;

  perform public.expire_booking_requests(v_coach_id);

  return jsonb_build_object(
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', occ.id,
        'date', occ.occurrence_date,
        'start_time', occ.start_time,
        'end_time', occ.end_time,
        'duration_minutes', occ.duration_minutes,
        'session_type', occ.session_type,
        'session_name', occ.session_name,
        'price', occ.price,
        'capacity', occ.max_bookings_per_slot,
        'location', occ.location,
        'place', occ.place,
        'pillar', occ.pillar_slot,
        'position', occ.position,
        'visibility', occ.visibility,
        'offered_to', occ.offered_to,
        'offered_names', coalesce((
          select jsonb_agg(athlete.full_name order by athlete.full_name)
          from public.athlete_profiles as athlete
          where athlete.id = any(occ.offered_to)
        ), '[]'::jsonb),
        'details', occ.details,
        'is_draft', occ.is_draft,
        'series_id', occ.series_id,
        'bookings', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', b.id,
            'athlete_id', b.athlete_id,
            'athlete_name', athlete.full_name,
            'status', b.status,
            'payment_status', b.payment_status,
            'expires_at', b.expires_at,
            'notes', b.notes,
            'created_at', b.created_at
          ) order by b.created_at)
          from public.coach_slot_bookings as b
          left join public.athlete_profiles as athlete on athlete.id = b.athlete_id
          where b.occurrence_id = occ.id
            and b.status in ('requested', 'pending_payment', 'booked', 'completed', 'no_show')
        ), '[]'::jsonb)
      ) order by occ.occurrence_date, occ.start_time)
      from public.coach_availability_slot_occurrences as occ
      where occ.coach_id = v_coach_id
        and occ.is_enabled
        and occ.occurrence_date between p_from and p_to
    ), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object('starts_at', busy.starts_at, 'ends_at', busy.ends_at) order by busy.starts_at)
      from public.coach_busy_blocks as busy
      where busy.coach_id = v_coach_id
        and busy.ends_at > public.eastern_timestamp(p_from, '00:00')
        and busy.starts_at < public.eastern_timestamp(p_to + 1, '00:00')
    ), '[]'::jsonb),
    'time_off', coalesce((
      select jsonb_agg(jsonb_build_object('date', off.off_date, 'note', off.note) order by off.off_date)
      from public.coach_time_off as off
      where off.coach_id = v_coach_id and off.off_date between p_from and p_to
    ), '[]'::jsonb),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', series.id,
        'session_type', series.session_type,
        'day_of_week', series.day_of_week,
        'start_time', series.start_time,
        'duration_minutes', series.duration_minutes,
        'location', series.location,
        'place', series.place,
        'ends_on', series.ends_on
      ))
      from public.coach_session_series as series
      where series.coach_id = v_coach_id and series.is_active
    ), '[]'::jsonb),
    'rules', (
      select jsonb_build_object(
        'new_family_booking', coach.new_family_booking,
        'booking_window_weeks', coach.booking_window_weeks,
        'locations', coalesce(to_jsonb(coach.locations), '[]'::jsonb),
        'hourly_rate', coach.hourly_rate,
        'slug', coach.slug
      )
      from public.coaches as coach where coach.id = v_coach_id
    ),
    'calendar', (
      select jsonb_build_object(
        'connected', true,
        'account_email', conn.account_email,
        'last_synced_at', conn.last_synced_at,
        'sync_error', conn.sync_error,
        'can_write', conn.can_write
      )
      from public.coach_calendar_connections as conn where conn.coach_id = v_coach_id
    )
  );
end;
$function$

;

-- Message on a request: the coach's direct conversation with that family, created if needed.
-- Only for families who have booked or asked to book with this coach.
create or replace function public.open_family_conversation(p_athlete_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_coach uuid := public.current_coach_id();
  v_user uuid;
  v_name text;
  v_conversation_id uuid;
begin
  if v_coach is null or not exists (
    select 1 from public.coach_slot_bookings where coach_id = v_coach and athlete_id = p_athlete_id
  ) then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;
  select user_id, full_name into v_user, v_name from public.athlete_profiles where id = p_athlete_id;
  if v_user is null then
    raise exception 'This family has no account to message yet' using errcode = '22023';
  end if;
  select conversation.id into v_conversation_id
  from public.conversations as conversation
  where not coalesce(conversation.is_group, false) and conversation.owner_coach_id is null
    and exists (select 1 from public.conversation_participants p where p.conversation_id = conversation.id and p.user_id = v_me)
    and exists (select 1 from public.conversation_participants p where p.conversation_id = conversation.id and p.user_id = v_user)
  order by conversation.last_message_at desc nulls last
  limit 1;
  if v_conversation_id is null then
    insert into public.conversations (created_by, is_group, title) values (v_me, false, v_name)
      returning id into v_conversation_id;
    insert into public.conversation_participants (conversation_id, user_id, role)
      values (v_conversation_id, v_me, 'owner'), (v_conversation_id, v_user, 'member');
  end if;
  return v_conversation_id;
end;
$$;

revoke all on function public.open_family_conversation(uuid) from public, anon;
grant execute on function public.open_family_conversation(uuid) to authenticated;
