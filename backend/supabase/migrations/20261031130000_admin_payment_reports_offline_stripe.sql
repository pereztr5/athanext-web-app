-- Admin Payments: expose offline vs online + Stripe ids for test/live filtering.
-- Builds on get_payment_reports() that already unions session payments and paid camps.
-- pay_channel: 'online' (card / Stripe) or 'offline' (direct, outside, pending_offline).
-- No new table columns — reuses booking.payment_status, camp pay_method, and Stripe ids.
-- Safe to run more than once.

drop function if exists public.get_payment_reports();

create or replace function public.get_payment_reports()
returns table (
  payment_id bigint,
  athlete_name text,
  slot_name text,
  coach_name text,
  coach_offer_amount numeric,
  platform_fee numeric,
  stripe_fee numeric,
  net_amount numeric,
  transaction_time timestamp with time zone,
  payment_kind text,
  pay_channel text,
  stripe_session_id text,
  stripe_payment_intent text
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  -- Session card payments (Stripe).
  select
    p.payment_id,
    coalesce(ap.full_name, 'N/a') as athlete_name,
    coalesce(occ.session_name, 'N/a') as slot_name,
    coalesce(c.name, 'N/a') as coach_name,
    p.coach_offer_amount,
    p.platform_fee_amount as platform_fee,
    p.stripe_fees as stripe_fee,
    p.stripe_net_amount as net_amount,
    p.transaction_time,
    'session'::text as payment_kind,
    'online'::text as pay_channel,
    p.stripe_session_id,
    p.stripe_payment_intent
  from public.payments as p
  join public.coach_slot_bookings as b on b.id = p.booking_id
  left join public.athlete_profiles as ap on ap.id = b.athlete_id
  left join public.coach_availability_slot_occurrences as occ on occ.id = p.slot_id
  left join public.coaches as c on c.id = b.coach_id

  union all

  -- Session offline (paying offline / paid directly / outside the app). No payments row.
  select
    ('x' || left(replace(b.id::text, '-', ''), 16))::bit(64)::bigint as payment_id,
    coalesce(ap.full_name, 'N/a') as athlete_name,
    coalesce(nullif(trim(occ.session_name), ''), nullif(trim(occ.pillar_slot), ''), 'Session') as slot_name,
    coalesce(c.name, 'N/a') as coach_name,
    round(coalesce(occ.price, 0)::numeric, 2) as coach_offer_amount,
    0::numeric as platform_fee,
    null::numeric as stripe_fee,
    round(coalesce(occ.price, 0)::numeric, 2) as net_amount,
    coalesce(b.updated_at, b.created_at) as transaction_time,
    'session'::text as payment_kind,
    'offline'::text as pay_channel,
    null::text as stripe_session_id,
    null::text as stripe_payment_intent
  from public.coach_slot_bookings as b
  join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
  left join public.athlete_profiles as ap on ap.id = b.athlete_id
  left join public.coaches as c on c.id = b.coach_id
  where b.payment_status in ('direct', 'outside', 'pending_offline')
    and b.status in ('booked', 'completed', 'no_show')
    and coalesce(occ.price, 0) > 0
    and not exists (select 1 from public.payments as pay where pay.booking_id = b.id)

  union all

  -- Paid camp registrations (card = online; direct/outside = offline).
  select
    ('x' || left(replace(reg.id::text, '-', ''), 16))::bit(64)::bigint as payment_id,
    nullif(btrim(concat_ws(' ', reg.athlete_first_name, reg.athlete_last_name)), '') as athlete_name,
    ('Camp · ' || coalesce(pkg.package_name, 'Camp'))::text as slot_name,
    coalesce(coach.name, 'N/a') as coach_name,
    round(coalesce(reg.price_cents, 0) / 100.0, 2) as coach_offer_amount,
    0::numeric as platform_fee,
    coalesce(pp.stripe_fee, null)::numeric as stripe_fee,
    coalesce(
      pp.stripe_net_amount,
      round(coalesce(reg.price_cents, 0) / 100.0, 2)
    )::numeric as net_amount,
    coalesce(reg.paid_at, reg.updated_at, reg.created_at) as transaction_time,
    'camp'::text as payment_kind,
    case
      when reg.pay_method in ('direct', 'outside') then 'offline'::text
      else 'online'::text
    end as pay_channel,
    coalesce(pp.stripe_session_id, reg.stripe_session_id) as stripe_session_id,
    pp.stripe_payment_intent as stripe_payment_intent
  from public.camp_registrations as reg
  join public.coach_packages as pkg on pkg.id = reg.camp_id and pkg.kind = 'camp'
  left join public.coaches as coach on coach.id = reg.coach_id
  left join lateral (
    select
      purchase.stripe_fee,
      purchase.stripe_net_amount,
      purchase.total_amount,
      purchase.stripe_session_id,
      purchase.stripe_payment_intent
    from public.package_purchases as purchase
    where purchase.id = reg.purchase_id
       or (reg.signup_id is not null and purchase.camp_signup_id = reg.signup_id)
    order by (purchase.id = reg.purchase_id) desc, purchase.purchase_date desc nulls last
    limit 1
  ) as pp on true
  where reg.status = 'paid';
$$;

revoke all on function public.get_payment_reports() from public, anon;
grant execute on function public.get_payment_reports() to authenticated;

notify pgrst, 'reload schema';
