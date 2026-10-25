-- My Business "Money in" counts every way a coach gets paid (Oct 29).
--
-- get_coach_payments() built Money in from sessions paid in the app and paid invoices only.
-- Packages, camp sign-ups and offline payments were missing. It now also returns 'money_in':
-- every payment the coach received in the last 400 days, each once, newest first:
--   id               '<kind>:<row id>', unique
--   kind             'session' | 'package' | 'camp' | 'invoice'
--   channel          'in_app' (through AthaNext) | 'direct' (paid to the coach: cash, Zelle, ...)
--   own              a family the coach brought (no marketplace fee)
--   date             when it was paid: payment time, purchase time, camp paid_at, invoice paid_at;
--                    the session day for sessions paid directly (no payment time is recorded)
--   amount           what the coach receives, the list price share, as everywhere else:
--                    sessions coach_offer_amount (else the session price), packages and camps the
--                    list price (total_amount / price_cents; platform and card fees stay with
--                    AthaNext), invoices their amount
--   athlete, family, service, athlete_id, booking_id, purchase_id, registration_id, invoice_id
-- Sources:
--   session in_app   coach_slot_bookings 'paid' (booked, completed, no_show), payments summed
--   session direct   coach_slot_bookings 'direct' / 'outside' with a price (as get_coach_offline_payments)
--   package in_app   package_purchases bought by the family (source 'package', not a camp sign-up,
--                    not granted by an admin, not a package from before AthaNext or tied to an
--                    invoice: the invoice counts once paid)
--   camp in_app      paid card registrations (one per athlete; refunded ones are cancelled)
--   camp direct      paid registrations paid directly or outside (as get_coach_offline_payments)
--   invoice          paid invoices: card in_app, marked paid direct
-- Credits used on a session are not money in (the package was). 'in_app', 'invoices' and
-- 'clients' are unchanged.
--
-- Function body is the live definition with only the 'money_in' key added.

CREATE OR REPLACE FUNCTION public.get_coach_payments()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach uuid := public.current_coach_id();
  v_since timestamptz := now() - interval '400 days';
  v_money jsonb;
begin
  if v_coach is null then
    raise exception 'Only coaches have payments' using errcode = '42501';
  end if;

  with money as (
    -- Sessions paid in the app.
    select
      'session:' || b.id as id, 'session'::text as kind, 'in_app'::text as channel,
      public.is_own_client(v_coach, b.athlete_id) as own,
      to_jsonb(coalesce(pay.paid_at, b.updated_at)) as date,
      coalesce(pay.paid_at, b.updated_at) as sort_at,
      coalesce(pay.amount, occ.price, 0)::numeric as amount,
      coalesce(a.full_name, 'Athlete') as athlete,
      coalesce(up.name, a.full_name, 'Family') as family,
      coalesce(occ.session_name, 'Session') as service,
      b.athlete_id, b.id as booking_id, null::uuid as purchase_id, null::uuid as registration_id, null::uuid as invoice_id
    from public.coach_slot_bookings as b
    join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
    left join lateral (
      select max(p.transaction_time) as paid_at, sum(p.coach_offer_amount) as amount
      from public.payments as p where p.booking_id = b.id
    ) as pay on true
    left join public.athlete_profiles as a on a.id = b.athlete_id
    left join public.user_profiles as up on up.id = a.user_id
    where b.coach_id = v_coach and b.payment_status = 'paid'
      and b.status in ('booked', 'completed', 'no_show')

    union all
    -- Sessions paid to the coach directly.
    select
      'session:' || b.id, 'session', 'direct',
      public.is_own_client(v_coach, b.athlete_id),
      to_jsonb(occ.occurrence_date),
      occ.occurrence_date::timestamp at time zone 'America/New_York',
      coalesce(occ.price, 0)::numeric,
      coalesce(nullif(trim(a.full_name), ''), 'Athlete'),
      coalesce(up.name, a.full_name, 'Family'),
      coalesce(nullif(trim(occ.session_name), ''), nullif(trim(occ.pillar_slot), ''), 'Session'),
      b.athlete_id, b.id, null, null, null
    from public.coach_slot_bookings as b
    join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
    left join public.athlete_profiles as a on a.id = b.athlete_id
    left join public.user_profiles as up on up.id = a.user_id
    where b.coach_id = v_coach
      and b.payment_status in ('direct', 'outside')
      and b.status in ('booked', 'completed', 'no_show')
      and coalesce(occ.price, 0) > 0

    union all
    -- Packages the family bought in the app (camp sign-ups are counted per athlete below).
    select
      'package:' || pp.id,
      case when pkg.kind = 'camp' then 'camp' else 'package' end,
      'in_app',
      coalesce(public.is_own_client(v_coach, fam.athlete_id), false),
      to_jsonb(pp.purchase_date),
      pp.purchase_date,
      pp.total_amount,
      coalesce(fam.athlete_name, up.name, 'Athlete'),
      coalesce(up.name, fam.athlete_name, 'Family'),
      coalesce(pkg.package_name, pp.custom_name, 'Package'),
      fam.athlete_id, null, pp.id, null, null
    from public.package_purchases as pp
    left join public.coach_packages as pkg on pkg.id = pp.package_id
    left join public.user_profiles as up on up.id = pp.user_id
    left join lateral (
      select athlete.id as athlete_id, athlete.full_name as athlete_name
      from public.athlete_profiles as athlete
      where athlete.id = up.athlete_id or (pp.user_id is not null and athlete.user_id = pp.user_id)
      order by (athlete.id = up.athlete_id) desc, athlete.created_at
      limit 1
    ) as fam on true
    where pp.coach_id = v_coach
      and pp.source = 'package'
      and pp.camp_signup_id is null
      and pp.outside is null
      and pp.invoice_id is null
      and pp.granted_by is null
      and pp.revoked_at is null
      and pp.status in ('active', 'expired', 'completed')
      and coalesce(pp.total_amount, 0) > 0

    union all
    -- Camp sign-ups: paid by card in the app, or paid to the coach directly / outside.
    select
      'camp:' || reg.id, 'camp',
      case when reg.pay_method = 'card' then 'in_app' else 'direct' end,
      coalesce(signup.platform_waived, reg.pay_method <> 'card'),
      to_jsonb(coalesce(reg.paid_at, pp.purchase_date, reg.created_at)),
      coalesce(reg.paid_at, pp.purchase_date, reg.created_at),
      round(reg.price_cents / 100.0, 2),
      coalesce(nullif(trim(concat_ws(' ', trim(reg.athlete_first_name), nullif(trim(reg.athlete_last_name), ''))), ''), 'Athlete'),
      coalesce(nullif(trim(reg.parent_name), ''), up.name, 'Family'),
      coalesce(nullif(trim(camp.package_name), ''), 'Camp'),
      reg.athlete_id, null, reg.purchase_id, reg.id, null
    from public.camp_registrations as reg
    left join public.camp_signups as signup on signup.id = reg.signup_id
    left join public.package_purchases as pp on pp.id = reg.purchase_id
    left join public.coach_packages as camp on camp.id = reg.camp_id
    left join public.user_profiles as up on up.id = reg.user_id
    where reg.coach_id = v_coach
      and reg.status = 'paid'
      and reg.price_cents > 0

    union all
    -- Paid invoices: by card in the app, or marked paid.
    select
      'invoice:' || i.id, 'invoice',
      case when i.paid_method = 'card' then 'in_app' else 'direct' end,
      true,
      to_jsonb(i.paid_at),
      i.paid_at,
      i.amount,
      coalesce(nullif(i.athlete_name, ''), i.family_name, 'Athlete'),
      coalesce(nullif(i.family_name, ''), 'Family'),
      i.service,
      i.athlete_id, null, null, null, i.id
    from public.coach_invoices as i
    where i.coach_id = v_coach and i.status = 'paid' and i.paid_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'kind', m.kind, 'channel', m.channel, 'own', m.own, 'date', m.date, 'amount', m.amount,
    'athlete', m.athlete, 'family', m.family, 'service', m.service, 'athlete_id', m.athlete_id,
    'booking_id', m.booking_id, 'purchase_id', m.purchase_id, 'registration_id', m.registration_id,
    'invoice_id', m.invoice_id
  ) order by m.sort_at desc, m.id), '[]'::jsonb)
  into v_money
  from money as m
  where m.sort_at >= v_since and m.amount > 0;

  return jsonb_build_object(
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'athlete_id', i.athlete_id, 'family', i.family_name, 'athlete', i.athlete_name,
        'service', i.service, 'amount', i.amount, 'due', i.due_date, 'note', i.note, 'status', i.status,
        'paid_at', i.paid_at, 'paid_method', i.paid_method, 'reminders', i.reminders, 'created_at', i.created_at
      ) order by i.due_date desc, i.created_at desc)
      from public.coach_invoices i where i.coach_id = v_coach
    ), '[]'::jsonb),
    'in_app', coalesce((
      select jsonb_agg(jsonb_build_object(
        'booking_id', b.id,
        'athlete', coalesce(a.full_name, 'Athlete'),
        'family', coalesce(up.name, a.full_name, 'Family'),
        'service', coalesce(occ.session_name, 'Session'),
        'date', coalesce(p.transaction_time, b.updated_at),
        'amount', coalesce(p.coach_offer_amount, occ.price),
        'own', public.is_own_client(v_coach, b.athlete_id)
      ) order by coalesce(p.transaction_time, b.updated_at) desc)
      from public.coach_slot_bookings b
      join public.coach_availability_slot_occurrences occ on occ.id = b.occurrence_id
      left join public.payments p on p.booking_id = b.id
      left join public.athlete_profiles a on a.id = b.athlete_id
      left join public.user_profiles up on up.id = a.user_id
      where b.coach_id = v_coach and b.payment_status = 'paid'
        and b.status in ('booked', 'completed', 'no_show')
        and coalesce(p.transaction_time, b.updated_at) >= now() - interval '120 days'
    ), '[]'::jsonb),
    'money_in', v_money,
    'clients', coalesce((
      select jsonb_agg(distinct jsonb_build_object(
        'athlete_id', a.id, 'athlete', a.full_name, 'family', coalesce(up.name, r.client_name, a.full_name)
      ))
      from public.coach_client_referrals r
      join public.athlete_profiles a on a.id = r.athlete_id
      left join public.user_profiles up on up.id = a.user_id
      where r.coach_id = v_coach and r.status = 'confirmed'
    ), '[]'::jsonb)
  );
end;
$function$;

notify pgrst, 'reload schema';
