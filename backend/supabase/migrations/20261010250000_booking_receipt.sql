-- Booking receipt (Working Copy 2, a-receipt).
-- One Stripe checkout can cover several bookings across coaches, so the confirmation page reads
-- them all through one function instead of a single-row select.
--
-- get_booking_receipt(p_stripe_session_id, p_booking_ids) returns the bookings the caller may
-- see (their own athlete profile, an athlete profile they manage, or a booking they created):
--   * every booking with that Stripe checkout session,
--   * every booking in p_booking_ids (credits-only and pay-the-coach-directly bookings),
--   * for a paid checkout, the caller's package credit bookings for the same athlete created in
--     the same request: create-booking-payment inserts them (payment_status 'credit', no Stripe
--     session) just before the Stripe rows, so they fall within 2 minutes before the earliest one.
-- Each booking carries the session, coach (with pay mode and pay note) and, once the payment is
-- recorded, the amount charged and the fees. Times are Eastern wall times like the rest of the
-- scheduling code.

create or replace function public.get_booking_receipt(
  p_stripe_session_id text default null,
  p_booking_ids uuid[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_athlete uuid := public.current_athlete_id();
  v_session text := nullif(trim(coalesce(p_stripe_session_id, '')), '');
  v_ids uuid[];
  v_first public.coach_slot_bookings%rowtype;
  v_bookings jsonb;
begin
  if v_me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  with visible as (
    select b.*
    from public.coach_slot_bookings as b
    left join public.athlete_profiles as a on a.id = b.athlete_id
    where a.user_id = v_me
       or b.created_by = v_me
       or (v_athlete is not null and b.athlete_id = v_athlete)
  ),
  checkout as (
    select * from visible where v_session is not null and stripe_session_id = v_session
  ),
  -- Only a paid checkout has credits booked with it; requests are created after Stripe.
  paid_start as (
    select athlete_id, min(created_at) as started
    from checkout
    where payment_status in ('paid', 'unpaid')
    group by athlete_id
  ),
  credits as (
    select v.id
    from visible as v
    join paid_start as p on p.athlete_id = v.athlete_id
    where v.payment_status = 'credit'
      and v.stripe_session_id is null
      and v.created_by = v_me
      and v.created_at between p.started - interval '2 minutes' and p.started
  ),
  listed as (
    select id from visible where p_booking_ids is not null and id = any(p_booking_ids)
  )
  select array_agg(distinct s.id) into v_ids
  from (
    select id from checkout
    union select id from credits
    union select id from listed
  ) as s;

  if v_ids is null then
    return jsonb_build_object('bookings', '[]'::jsonb);
  end if;

  select * into v_first
  from public.coach_slot_bookings
  where id = any(v_ids)
  order by created_at, id
  limit 1;

  select jsonb_agg(jsonb_build_object(
      'id', b.id,
      'athlete_id', b.athlete_id,
      'status', b.status,
      'payment_status', b.payment_status,
      'created_at', b.created_at,
      'coach', jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'pay_mode', c.pay_mode,
        'pay_note', c.pay_note
      ),
      'session_name', occ.session_name,
      'session_type', occ.session_type,
      'pillar', occ.pillar_slot,
      'occurrence_date', occ.occurrence_date,
      'start_time', occ.start_time,
      'end_time', occ.end_time,
      'duration_minutes', occ.duration_minutes,
      'location', occ.location,
      'place', occ.place,
      'price', occ.price,
      'charged', pay.total_amount,
      'platform_fee', pay.platform_fee_amount,
      'processing_fee', pay.stripe_price_amount
    ) order by occ.occurrence_date, occ.start_time, b.created_at)
  into v_bookings
  from public.coach_slot_bookings as b
  join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
  join public.coaches as c on c.id = b.coach_id
  left join public.payments as pay on pay.booking_id = b.id
  where b.id = any(v_ids);

  return jsonb_build_object(
    'receipt_number', 'AN-' || upper(left(v_first.id::text, 8)),
    'issued_at', v_first.created_at,
    'email', (select u.email from auth.users as u where u.id = v_me),
    'bookings', coalesce(v_bookings, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_booking_receipt(text, uuid[]) from public, anon;
grant execute on function public.get_booking_receipt(text, uuid[]) to authenticated;
