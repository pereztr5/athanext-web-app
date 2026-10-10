-- Working Copy: My Schedule and its booking requests page.
-- get_coach_booking_requests: adds the parent's name and a badge for families the coach already
--   knows (invited by the coach, or a client link), so a card reads "Jordan Patel · for Ava, 13 ·
--   New family" or the badge.
-- suggest_booking_open_times: "Other time" offers up to 3 of the coach's own open slots instead
--   of a 1-on-1 request. The slots stay open; the family is added to who they were offered to,
--   gets the coach's message, and the request closes like suggest_booking_time does.
-- visible_sessions: a clients-only open slot offered to a family is visible to that family, so a
--   new family can book a time the coach suggested.
-- Declining with a reason and message reuses coach_decline_note (20261010140000).

drop function if exists public.get_coach_booking_requests();
create function public.get_coach_booking_requests()
returns table(
  booking_id uuid, occurrence_id uuid, athlete_id uuid, athlete_name text, athlete_photo text,
  session_name text, session_type text, location text, place text, price numeric,
  occurrence_date date, start_time time, end_time time, notes text,
  requested_at timestamptz, expires_at timestamptz, capacity integer, taken integer,
  athlete_position text, athlete_birth_date date, payment_status text,
  parent_name text, family_badge text
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
    athlete.position, athlete.date_of_birth, booking.payment_status,
    (select up.name from public.user_profiles as up
      where (up.athlete_id = athlete.id or up.id = athlete.user_id)
        and up.persona_type = 'parent' and coalesce(up.name, '') <> '' and up.name <> athlete.full_name
      limit 1),
    (select case when referral.initiated_by = 'coach' then 'Invited by you' else 'Your client' end
      from public.coach_client_referrals as referral
      where referral.coach_id = v_coach_id and referral.athlete_id = booking.athlete_id
        and referral.status <> 'declined'
      order by referral.created_at desc
      limit 1)
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

-- Other time: offer 1 to 3 of the coach's open 1-on-1 slots instead of the requested time.
create or replace function public.suggest_booking_open_times(
  p_booking_id uuid,
  p_occurrence_ids uuid[],
  p_message text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_booking public.coach_slot_bookings;
  v_occ public.coach_availability_slot_occurrences;
  v_ids uuid[] := array(select distinct unnest(coalesce(p_occurrence_ids, '{}'::uuid[])));
  v_count integer;
  v_times text;
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
    raise exception 'Other time works for 1-on-1 requests' using errcode = '22023';
  end if;
  if coalesce(array_length(v_ids, 1), 0) not between 1 and 3 then
    raise exception 'Pick 1 to 3 of your open times' using errcode = '22023';
  end if;

  -- Each pick must be one of the coach's open 1-on-1 slots that nobody holds yet.
  select count(*)::integer into v_count
  from public.coach_availability_slot_occurrences as slot
  where slot.id = any(v_ids)
    and slot.id <> v_occ.id
    and slot.coach_id = v_coach
    and slot.is_enabled
    and not slot.is_draft
    and slot.session_type = 'individual'
    and public.eastern_timestamp(slot.occurrence_date, slot.start_time) > now()
    and not exists (
      select 1 from public.coach_slot_bookings as b
      where b.occurrence_id = slot.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
    );
  if v_count <> array_length(v_ids, 1) then
    raise exception 'One of those times is no longer open' using errcode = '22023';
  end if;

  -- The family goes first in offered_to so "Waiting for the family" names them.
  update public.coach_availability_slot_occurrences as slot
    set offered_to = array[v_booking.athlete_id] || array_remove(coalesce(slot.offered_to, '{}'::uuid[]), v_booking.athlete_id),
        details = coalesce(slot.details, '{}'::jsonb) || jsonb_build_object('suggested_for', v_booking.id)
    where slot.id = any(v_ids);

  update public.coach_slot_bookings
    set status = 'canceled', canceled_at = now(), cancellation_reason = 'Coach suggested another time', updated_at = now()
    where id = v_booking.id;
  if v_occ.details ? 'requested_time' then
    update public.coach_availability_slot_occurrences
      set is_enabled = false, disabled_reason = 'removed'
      where id = v_occ.id;
  end if;

  select string_agg(to_char(slot.occurrence_date, 'FMDay, Mon FMDD') || ' at ' || ltrim(to_char(slot.start_time, 'FMHH12:MI AM'), '0'), '; '
                    order by slot.occurrence_date, slot.start_time)
    into v_times
  from public.coach_availability_slot_occurrences as slot
  where slot.id = any(v_ids);

  perform public.message_session_families_to(
    v_booking.athlete_id,
    coalesce(nullif(trim(p_message), ''), 'That time doesn''t work for me. Any of these would: ' || v_times || ' (Eastern). Book one from My Sessions.')
  );
  return array_length(v_ids, 1);
end;
$$;

revoke all on function public.suggest_booking_open_times(uuid, uuid[], text) from public, anon;
grant execute on function public.suggest_booking_open_times(uuid, uuid[], text) to authenticated;

-- Same as 20261006100000, plus: clients-only slots are visible to families they were offered to.
create or replace function public.visible_sessions(p_coach_id uuid, p_athlete_id uuid, p_from date, p_to date)
returns table(
  id uuid, coach_id uuid, occurrence_date date, start_time time, end_time time,
  duration_minutes integer, session_type text, session_name text, price numeric,
  capacity integer, location text, place text, pillar text, "position" text,
  visibility text, details jsonb, booked_count integer, my_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select occ.id, occ.coach_id, occ.occurrence_date, occ.start_time, occ.end_time,
    occ.duration_minutes, occ.session_type, occ.session_name, occ.price,
    occ.max_bookings_per_slot, occ.location, occ.place, occ.pillar_slot, occ.position,
    occ.visibility, occ.details,
    (select count(*)::integer from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')),
    (select b.status from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.athlete_id = p_athlete_id
        and b.status in ('requested', 'pending_payment', 'booked', 'completed')
      order by b.created_at desc limit 1)
  from public.coach_availability_slot_occurrences as occ
  where occ.coach_id = p_coach_id
    and occ.occurrence_date between p_from and p_to
    and occ.is_enabled
    and not occ.is_draft
    and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
    and not public.coach_is_busy(occ.coach_id, occ.occurrence_date, occ.start_time, occ.end_time)
    and (
      occ.visibility = 'open'
      or (occ.visibility = 'offered' and p_athlete_id = any(occ.offered_to))
      or (occ.visibility = 'clients' and (public.is_coach_client(occ.coach_id, p_athlete_id) or p_athlete_id = any(occ.offered_to)))
    );
$$;

revoke all on function public.visible_sessions(uuid, uuid, date, date) from public, anon, authenticated;
