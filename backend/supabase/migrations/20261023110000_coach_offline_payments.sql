-- "Offline payments" on My Business, for every coach (paying in the app or not).
--
-- get_coach_offline_payments() returns, for the signed-in coach's own bookings and camps only:
-- * waiting: sessions the family pays offline (cash, Zelle, Venmo) that the coach hasn't marked
--   paid yet (payment_status pending_offline). Mark as paid uses confirm_offline_payment().
-- * paid_month / paid_total: money paid to the coach directly, kept apart from in-app earnings.
--   Sessions: payment_status direct (confirmed offline, or pay the coach directly) or outside
--   (paid outside the app), with a price, not cancelled; dated by the session day. Camps:
--   registrations paid direct or outside, dated by paid_at.
-- * recent: the latest 10 of those, sessions and camps together.
-- Amounts are in dollars; months and days are Eastern, like the rest of the app.
-- Safe to run more than once.

create or replace function public.get_coach_offline_payments()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_today date := (timezone('America/New_York', now()))::date;
  v_month date := date_trunc('month', (timezone('America/New_York', now()))::date)::date;
begin
  if v_coach is null then
    raise exception 'Only coaches have payments' using errcode = '42501';
  end if;

  return (
    with paid as (
      select
        b.id,
        'session'::text as kind,
        coalesce(nullif(trim(occ.session_name), ''), nullif(trim(occ.pillar_slot), ''), 'Session') as name,
        coalesce(nullif(trim(a.full_name), ''), 'Athlete') as athlete_name,
        occ.occurrence_date as paid_on,
        coalesce(occ.price, 0)::numeric as amount,
        b.payment_status as method
      from public.coach_slot_bookings as b
      join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
      left join public.athlete_profiles as a on a.id = b.athlete_id
      where b.coach_id = v_coach
        and b.payment_status in ('direct', 'outside')
        and b.status in ('booked', 'completed', 'no_show')
        and coalesce(occ.price, 0) > 0
      union all
      select
        reg.id,
        'camp'::text,
        coalesce(nullif(trim(pkg.package_name), ''), 'Camp'),
        coalesce(nullif(trim(concat_ws(' ', trim(reg.athlete_first_name), nullif(trim(reg.athlete_last_name), ''))), ''), 'Athlete'),
        (timezone('America/New_York', coalesce(reg.paid_at, reg.created_at)))::date,
        (reg.price_cents / 100.0)::numeric,
        reg.pay_method
      from public.camp_registrations as reg
      left join public.coach_packages as pkg on pkg.id = reg.camp_id
      where reg.coach_id = v_coach
        and reg.status = 'paid'
        and reg.pay_method in ('direct', 'outside')
        and reg.price_cents > 0
    )
    select jsonb_build_object(
      'waiting', coalesce((
        select jsonb_agg(row_to_json(x)::jsonb order by x.occurrence_date, x.start_time)
        from (
          select
            b.id as booking_id,
            b.occurrence_id,
            b.athlete_id,
            coalesce(nullif(trim(a.full_name), ''), 'Athlete') as athlete_name,
            coalesce(
              (select nullif(trim(up.name), '') from public.user_profiles as up
                where (up.athlete_id = a.id or up.id = a.user_id)
                  and up.persona_type = 'parent'
                  and coalesce(up.name, '') <> '' and up.name <> a.full_name
                limit 1),
              nullif(trim(a.full_name), ''),
              'Family'
            ) as payer_name,
            occ.occurrence_date,
            occ.start_time,
            coalesce(nullif(trim(occ.session_name), ''), nullif(trim(occ.pillar_slot), ''), 'Session') as session_name,
            coalesce(occ.price, 0)::numeric as amount,
            (occ.occurrence_date < v_today) as session_done
          from public.coach_slot_bookings as b
          join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
          left join public.athlete_profiles as a on a.id = b.athlete_id
          where b.coach_id = v_coach
            and b.payment_status = 'pending_offline'
            and b.status in ('booked', 'completed')
        ) as x
      ), '[]'::jsonb),
      'paid_month', coalesce((select sum(amount) from paid where paid_on >= v_month and paid_on < (v_month + interval '1 month')::date), 0),
      'paid_total', coalesce((select sum(amount) from paid), 0),
      'recent', coalesce((
        select jsonb_agg(row_to_json(r)::jsonb order by r.paid_on desc, r.id)
        from (select * from paid order by paid_on desc, id limit 10) as r
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_coach_offline_payments() from public, anon;
grant execute on function public.get_coach_offline_payments() to authenticated;
