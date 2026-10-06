-- ATH-86: Booking only mode. A coach can take bookings in AthaNext and collect payment
-- themselves. New bookings for those coaches are confirmed with payment_status 'direct' and
-- never reach Stripe; sessions already paid in the app are untouched, and switching back
-- restores in-app payment for new bookings.

alter table public.coaches
  add column if not exists pay_mode text not null default 'app' check (pay_mode in ('app', 'self')),
  add column if not exists pay_note text check (char_length(pay_note) <= 200);

alter table public.coach_slot_bookings drop constraint if exists bookings_v3_payment_status;
alter table public.coach_slot_bookings
  add constraint bookings_v3_payment_status
  check (payment_status = any (array['unpaid', 'requires_action', 'paid', 'refunded', 'direct']));

-- booking_coach_card: the family's checkout needs the coach's pay mode and note.
create or replace function public.booking_coach_card(p_coach_id uuid, p_athlete_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'id', coach.id,
    'name', coach.name,
    'slug', coach.slug,
    'image_url', coalesce(coach.profile_image_url, coach.image_url),
    'specialties', coalesce(to_jsonb(coach.specialties), '[]'::jsonb),
    'positions', coalesce(to_jsonb(coach.positions), '[]'::jsonb),
    'hourly_rate', coach.hourly_rate,
    'locations', coalesce(to_jsonb(coach.locations), '[]'::jsonb),
    'rating', coach.rating,
    'total_reviews', coach.total_reviews,
    'is_client', public.is_coach_client(coach.id, p_athlete_id),
    'needs_request', coach.new_family_booking = 'request' and not public.is_coach_client(coach.id, p_athlete_id),
    'credits', public.coach_credits_left(coach.id, p_athlete_id),
    'pay_mode', coach.pay_mode,
    'pay_note', coach.pay_note
  )
  from public.coaches as coach
  where coach.id = p_coach_id;
$function$;

-- respond_to_booking_request: accepting a request for a booking only coach confirms it.
create or replace function public.respond_to_booking_request(p_booking_id uuid, p_accept boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Booking only coaches (ATH-86): accepting confirms it; the family pays the coach directly.
  if p_accept and exists (
    select 1 from public.coach_slot_bookings b join public.coaches c on c.id = b.coach_id
    where b.id = p_booking_id and c.pay_mode = 'self'
  ) then
    update public.coach_slot_bookings
      set status = 'booked', payment_status = 'direct', updated_at = now()
      where id = p_booking_id;
    return 'booked';
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
$function$;

-- get_athlete_session: the session page says "Pay {coach} directly" with the coach's note.
create or replace function public.get_athlete_session(p_occurrence_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'coach', (select jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'photo', coalesce(c.profile_image_url, c.image_url), 'pay_mode', c.pay_mode, 'pay_note', c.pay_note)
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
$function$;
