-- ATH-76: Coach Home.
-- get_coach_earnings: money in per day (sessions paid in the app, plus packages) for the
--   chosen period and the one before it, what families still owe on accepted bookings, and
--   how much of that is overdue (the session has started).
-- get_feedback_due: the coach's sessions from the last 14 days that ended without feedback.

create or replace function public.get_coach_earnings(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_today date := (timezone('America/New_York', now()))::date;
  v_from date;
begin
  if v_coach is null then
    raise exception 'Only coaches have earnings' using errcode = '42501';
  end if;
  if p_days not between 1 and 90 then
    raise exception 'Pick 1 to 90 days' using errcode = '22023';
  end if;
  v_from := v_today - (p_days * 2 - 1);

  return jsonb_build_object(
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'amount', coalesce(m.amount, 0)) order by d.day), '[]'::jsonb)
      from generate_series(v_from, v_today, interval '1 day') as d(day)
      left join (
        select money_day, sum(amount) as amount
        from (
          select (timezone('America/New_York', coalesce(payment.transaction_time, booking.updated_at)))::date as money_day,
            payment.coach_offer_amount as amount
          from public.payments as payment
          join public.coach_slot_bookings as booking on booking.id = payment.booking_id
          where booking.coach_id = v_coach
            and booking.status in ('booked', 'completed', 'no_show')
          union all
          select (timezone('America/New_York', purchase.purchase_date))::date,
            coalesce(purchase.total_amount, 0)
          from public.package_purchases as purchase
          where purchase.coach_id = v_coach
            and coalesce(purchase.status, '') not in ('canceled', 'cancelled', 'refunded', 'pending')
        ) as money
        where money_day between v_from and v_today
        group by money_day
      ) as m on m.money_day = d.day::date
    ),
    'owed', coalesce((
      select sum(occ.price)
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
      where booking.coach_id = v_coach and booking.status = 'pending_payment' and booking.payment_status <> 'paid'
    ), 0),
    'overdue_count', (
      select count(*)
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
      where booking.coach_id = v_coach and booking.status = 'pending_payment' and booking.payment_status <> 'paid'
        and public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
    )
  );
end;
$$;

revoke all on function public.get_coach_earnings(integer) from public, anon;
grant execute on function public.get_coach_earnings(integer) to authenticated;

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
      'session_name', occ.session_name,
      'session_type', occ.session_type
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
