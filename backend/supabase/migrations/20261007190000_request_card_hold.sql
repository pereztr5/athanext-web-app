-- Requests from new families (ATH-85): the list says whether the family's card is held, so
-- the coach sees "Accept and charge $X". The card is held on Stripe's page and charged only
-- when the coach accepts (create-booking-payment).

drop function if exists public.get_coach_booking_requests();
create function public.get_coach_booking_requests()
returns table(
  booking_id uuid, occurrence_id uuid, athlete_id uuid, athlete_name text, athlete_photo text,
  session_name text, session_type text, location text, place text, price numeric,
  occurrence_date date, start_time time, end_time time, notes text,
  requested_at timestamptz, expires_at timestamptz, capacity integer, taken integer,
  athlete_position text, athlete_birth_date date, payment_status text
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
    athlete.position, athlete.date_of_birth, booking.payment_status
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
