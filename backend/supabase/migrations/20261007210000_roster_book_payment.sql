-- Book from My Athletes (ATH-77): the payment is picked automatically. A credit when the
-- family has one with this coach, paid outside AthaNext for the coach's own clients, otherwise
-- the family gets a link to book and pay. Undo removes the booking right after. "Pick another
-- time or several" lists more open times.

drop function if exists public.get_roster_open_times(uuid);
create or replace function public.get_roster_open_times(p_athlete_id uuid, p_limit integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_dow int;
  v_start time;
begin
  if v_coach is null then
    raise exception 'Only coaches can book their athletes' using errcode = '42501';
  end if;
  if p_athlete_id is null or p_athlete_id not in (select public.coach_roster_ids(v_coach)) then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;

  select extract(dow from occ.occurrence_date)::int, occ.start_time
    into v_dow, v_start
  from public.coach_slot_bookings as booking
  join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
  where booking.coach_id = v_coach and booking.athlete_id = p_athlete_id
    and booking.status in ('booked', 'completed')
    and occ.session_type = 'individual'
  group by 1, 2
  order by count(*) desc, max(occ.occurrence_date) desc
  limit 1;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', occ.id,
      'date', occ.occurrence_date,
      'startTime', occ.start_time,
      'endTime', occ.end_time,
      'price', occ.price,
      'place', coalesce(occ.place, occ.location),
      'suggested', v_dow is not null and extract(dow from occ.occurrence_date)::int = v_dow and occ.start_time = v_start
    ) order by
      (v_dow is not null and extract(dow from occ.occurrence_date)::int = v_dow and occ.start_time = v_start) desc,
      occ.occurrence_date, occ.start_time)
    from (
      select occ.*
      from public.coach_availability_slot_occurrences as occ
      where occ.coach_id = v_coach
        and occ.is_enabled
        and not occ.is_draft
        and occ.session_type = 'individual'
        and occ.visibility in ('open', 'clients')
        and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
        and (
          select count(*) from public.coach_slot_bookings as booking
          where booking.occurrence_id = occ.id
            and booking.status in ('requested', 'pending_payment', 'booked', 'completed')
        ) < occ.max_bookings_per_slot
      order by
        (v_dow is not null and extract(dow from occ.occurrence_date)::int = v_dow and occ.start_time = v_start) desc,
        occ.occurrence_date, occ.start_time
      limit least(greatest(coalesce(p_limit, 8), 1), 40)
    ) as occ
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_roster_open_times(uuid, integer) from public, anon;
grant execute on function public.get_roster_open_times(uuid, integer) to authenticated;

create or replace function public.get_roster_book_payment(p_athlete_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null or p_athlete_id not in (select public.coach_roster_ids(v_coach)) then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'credits', public.coach_credits_left(v_coach, p_athlete_id),
    'own_client', public.is_own_client(v_coach, p_athlete_id),
    'pays_direct', (select pay_mode = 'self' from public.coaches where id = v_coach)
  );
end;
$$;

-- Books the athlete into the coach's open times, paid with credits or outside AthaNext.
create or replace function public.coach_book_athlete(p_athlete_id uuid, p_occurrence_ids uuid[], p_payment text)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_occ public.coach_availability_slot_occurrences%rowtype;
  v_id uuid;
  v_ids uuid[] := '{}';
begin
  if v_coach is null or p_athlete_id not in (select public.coach_roster_ids(v_coach)) then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;
  if p_payment not in ('credit', 'outside') then
    raise exception 'Pick how this is paid' using errcode = '22023';
  end if;
  if p_payment = 'outside' and not public.is_own_client(v_coach, p_athlete_id) then
    raise exception 'Only families you brought to AthaNext can pay you outside the app' using errcode = '22023';
  end if;
  if coalesce(array_length(p_occurrence_ids, 1), 0) = 0 or array_length(p_occurrence_ids, 1) > 10 then
    raise exception 'Pick up to 10 times' using errcode = '22023';
  end if;

  for v_occ in
    select * from public.coach_availability_slot_occurrences
    where id = any(p_occurrence_ids) order by occurrence_date, start_time
    for update
  loop
    if v_occ.coach_id <> v_coach or not v_occ.is_enabled or v_occ.is_draft
       or public.eastern_timestamp(v_occ.occurrence_date, v_occ.start_time) <= now() then
      raise exception 'One of these times is no longer open' using errcode = '22023';
    end if;
    if (select count(*) from public.coach_slot_bookings
        where occurrence_id = v_occ.id and status in ('requested', 'pending_payment', 'booked', 'completed')) >= coalesce(v_occ.max_bookings_per_slot, 1) then
      raise exception 'One of these times just filled up' using errcode = '22023';
    end if;
    if exists (select 1 from public.coach_slot_bookings
               where occurrence_id = v_occ.id and athlete_id = p_athlete_id and status in ('requested', 'pending_payment', 'booked', 'completed')) then
      raise exception 'They are already booked at one of these times' using errcode = '22023';
    end if;
    insert into public.coach_slot_bookings (occurrence_id, weekly_slot_id, availability_id, coach_id, athlete_id, status, payment_status, created_by)
    values (v_occ.id, v_occ.weekly_slot_id, v_occ.availability_id, v_coach, p_athlete_id, 'booked', p_payment, auth.uid())
    returning id into v_id;
    if p_payment = 'credit' and public.redeem_coach_credit(v_id) is null then
      raise exception 'Not enough credits for every time you picked' using errcode = '22023';
    end if;
    v_ids := v_ids || v_id;
  end loop;
  if coalesce(array_length(v_ids, 1), 0) <> array_length(p_occurrence_ids, 1) then
    raise exception 'One of these times is no longer open' using errcode = '22023';
  end if;
  return v_ids;
end;
$$;

-- Undo right after booking: removes the bookings and gives credits back.
create or replace function public.coach_undo_booking(p_booking_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.package_purchases p set sessions_remaining = least(p.sessions_total, p.sessions_remaining + b.n), updated_at = now()
  from (
    select credit_purchase_id, count(*)::int as n from public.coach_slot_bookings
    where id = any(p_booking_ids) and coach_id = public.current_coach_id() and created_by = auth.uid()
      and created_at > now() - interval '15 minutes' and payment_status = 'credit' and credit_purchase_id is not null
    group by credit_purchase_id
  ) b
  where p.id = b.credit_purchase_id;
  delete from public.coach_slot_bookings
  where id = any(p_booking_ids) and coach_id = public.current_coach_id() and created_by = auth.uid()
    and created_at > now() - interval '15 minutes' and payment_status in ('credit', 'outside');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.get_roster_book_payment(uuid) from public, anon;
grant execute on function public.get_roster_book_payment(uuid) to authenticated;
revoke all on function public.coach_book_athlete(uuid, uuid[], text) from public, anon;
grant execute on function public.coach_book_athlete(uuid, uuid[], text) to authenticated;
revoke all on function public.coach_undo_booking(uuid[]) from public, anon;
grant execute on function public.coach_undo_booking(uuid[]) to authenticated;
