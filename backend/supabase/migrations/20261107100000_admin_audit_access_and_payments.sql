-- Admin portal audit (Oct 31):
-- 1. Admins couldn't see chats, group channels, repeating sessions, time off or calendar status, so
--    those admin pages were empty. Admins may now read them (the privacy policy says we may review
--    communications to keep users safe), delete group channels and channel members, and stop or
--    resume a repeating session or remove time off through functions that tidy the calendar the
--    same way the coach's own actions do.
-- 2. The Payments report (get_payment_reports) now includes session packages bought on their own,
--    and marks refunded card payments as refunded instead of paid.

-- 1. Read access -------------------------------------------------------------------------------
create policy "Admins read conversations" on public.conversations
  for select to authenticated using (public.is_admin());
create policy "Admins read conversation members" on public.conversation_participants
  for select to authenticated using (public.is_admin());
create policy "Admins read messages" on public.messages
  for select to authenticated using (public.is_admin());
create policy "Admins read session series" on public.coach_session_series
  for select to authenticated using (public.is_admin());
create policy "Admins read time off" on public.coach_time_off
  for select to authenticated using (public.is_admin());

-- Group channels only; one-to-one chats can't be deleted from the admin portal.
create policy "Admins delete group channels" on public.conversations
  for delete to authenticated using (public.is_admin() and is_group);
create policy "Admins remove channel members" on public.conversation_participants
  for delete to authenticated using (public.is_admin());

-- Repeating sessions and time off -----------------------------------------------------------------
-- Same as the coach's "Stop repeating": future unbooked times go, booked ones stay.
create or replace function public.admin_stop_series(p_series_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dropped integer;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.coach_session_series where id = p_series_id) then
    raise exception 'Series not found' using errcode = 'P0002';
  end if;
  v_dropped := public.schedule_drop_future(p_series_id);
  update public.coach_session_series set is_active = false where id = p_series_id;
  return v_dropped;
end;
$$;

-- Turns a stopped series back on. Its upcoming times are filled by the nightly fill-session-series
-- job (fill_session_series only lets the coach fill their own series from the app).
create or replace function public.admin_resume_series(p_series_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.coach_session_series set is_active = true where id = p_series_id;
  if not found then
    raise exception 'Series not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Same as the coach's "Restore day": removes the day off and turns its open times back on. Repeating
-- times that time off had removed come back with the nightly fill-session-series job.
create or replace function public.admin_remove_time_off(p_time_off_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_off record;
  v_occ record;
  v_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  delete from public.coach_time_off where id = p_time_off_id returning coach_id, off_date into v_off;
  if v_off.coach_id is null then
    raise exception 'Time off not found' using errcode = 'P0002';
  end if;
  for v_occ in
    select occ.id, occ.start_time, occ.end_time
    from public.coach_availability_slot_occurrences as occ
    where occ.coach_id = v_off.coach_id and occ.occurrence_date = v_off.off_date
      and not occ.is_enabled and occ.disabled_reason = 'time_off'
    order by occ.start_time
  loop
    if not exists (
      select 1 from public.coach_availability_slot_occurrences as other
      where other.coach_id = v_off.coach_id and other.occurrence_date = v_off.off_date and other.is_enabled
        and other.start_time < v_occ.end_time and v_occ.start_time < other.end_time
    ) then
      update public.coach_availability_slot_occurrences
        set is_enabled = true, disabled_reason = null
        where id = v_occ.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.admin_stop_series(uuid) from public, anon;
revoke all on function public.admin_resume_series(uuid) from public, anon;
revoke all on function public.admin_remove_time_off(uuid) from public, anon;
grant execute on function public.admin_stop_series(uuid) to authenticated;
grant execute on function public.admin_resume_series(uuid) to authenticated;
grant execute on function public.admin_remove_time_off(uuid) to authenticated;

-- 2. Payments report ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payment_reports()
 RETURNS TABLE(payment_id bigint, athlete_name text, slot_name text, coach_name text, coach_offer_amount numeric, platform_fee numeric, stripe_fee numeric, net_amount numeric, transaction_time timestamp with time zone, payment_kind text, pay_channel text, stripe_session_id text, stripe_payment_intent text, payment_status text, is_test boolean, gross_amount numeric, reference text, record_id text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
    p.stripe_payment_intent,
    case when b.payment_status = 'refunded' then 'refunded' else 'paid' end::text as payment_status,
    public.involves_test_account(b.coach_id, b.athlete_id, null) as is_test,
    coalesce(p.total_amount, p.coach_offer_amount)::numeric as gross_amount,
    coalesce(p.stripe_payment_intent, p.stripe_session_id, 'PAY-' || p.payment_id::text) as reference,
    b.id::text as record_id
  from public.payments as p
  join public.coach_slot_bookings as b on b.id = p.booking_id
  left join public.athlete_profiles as ap on ap.id = b.athlete_id
  left join public.coach_availability_slot_occurrences as occ on occ.id = p.slot_id
  left join public.coaches as c on c.id = b.coach_id

  union all

  -- Session offline (paying offline / paid directly / outside the app). No payments row.
  -- pending_offline = the coach hasn't confirmed the money yet.
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
    null::text as stripe_payment_intent,
    case when b.payment_status = 'pending_offline' then 'pending' else 'paid' end::text as payment_status,
    public.involves_test_account(b.coach_id, b.athlete_id, null) as is_test,
    round(coalesce(occ.price, 0)::numeric, 2) as gross_amount,
    'BKG-' || left(b.id::text, 8) as reference,
    b.id::text as record_id
  from public.coach_slot_bookings as b
  join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
  left join public.athlete_profiles as ap on ap.id = b.athlete_id
  left join public.coaches as c on c.id = b.coach_id
  where b.payment_status in ('direct', 'outside', 'pending_offline')
    and b.status in ('booked', 'completed', 'no_show')
    and coalesce(occ.price, 0) > 0
    and not exists (select 1 from public.payments as pay where pay.booking_id = b.id)

  union all

  -- Camp registrations: paid (card = online; direct/outside = offline), plus offline sign-ups
  -- still held (spot kept, money not confirmed) as pending.
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
    pp.stripe_payment_intent as stripe_payment_intent,
    case when reg.status = 'paid' then 'paid' else 'pending' end::text as payment_status,
    public.involves_test_account(reg.coach_id, reg.athlete_id, reg.user_id) as is_test,
    round(coalesce(reg.price_cents, 0) / 100.0, 2) as gross_amount,
    coalesce(pp.stripe_payment_intent, 'CAMP-' || left(reg.id::text, 8)) as reference,
    reg.id::text as record_id
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
  where reg.status = 'paid'
     or (
       reg.status = 'held'
       and reg.pay_method in ('direct', 'outside')
       and public.camp_reg_holds_spot(reg.status, reg.hold_expires_at)
     )

  union all

  -- Paid coach invoices (card = online; outside = offline).
  select
    ('x' || left(replace(inv.id::text, '-', ''), 16))::bit(64)::bigint as payment_id,
    coalesce(nullif(btrim(inv.athlete_name), ''), ap.full_name, nullif(btrim(inv.family_name), ''), 'N/a') as athlete_name,
    ('Invoice · ' || inv.service)::text as slot_name,
    coalesce(coach.name, 'N/a') as coach_name,
    round(inv.amount, 2) as coach_offer_amount,
    0::numeric as platform_fee,
    pp.stripe_fee::numeric as stripe_fee,
    coalesce(pp.stripe_net_amount, round(inv.amount, 2))::numeric as net_amount,
    coalesce(inv.paid_at, inv.created_at) as transaction_time,
    'invoice'::text as payment_kind,
    case when inv.paid_method = 'card' then 'online' else 'offline' end::text as pay_channel,
    coalesce(pp.stripe_session_id, inv.stripe_session_id) as stripe_session_id,
    coalesce(pp.stripe_payment_intent, inv.stripe_payment_intent) as stripe_payment_intent,
    'paid'::text as payment_status,
    public.involves_test_account(inv.coach_id, inv.athlete_id, null) as is_test,
    round(inv.amount, 2) as gross_amount,
    coalesce(pp.stripe_payment_intent, inv.stripe_payment_intent, 'INV-' || left(inv.id::text, 8)) as reference,
    inv.id::text as record_id
  from public.coach_invoices as inv
  left join public.athlete_profiles as ap on ap.id = inv.athlete_id
  left join public.coaches as coach on coach.id = inv.coach_id
  left join lateral (
    select
      purchase.stripe_fee,
      purchase.stripe_net_amount,
      purchase.stripe_session_id,
      purchase.stripe_payment_intent
    from public.package_purchases as purchase
    where purchase.invoice_id = inv.id
    order by purchase.purchase_date desc nulls last
    limit 1
  ) as pp on true
  where inv.status = 'paid'

  union all

  -- Session packages bought on their own (coach or academy packages). Camp and invoice payments
  -- are recorded as package purchases too but already show above; admin-granted credits aren't money.
  select
    ('x' || left(replace(pur.id::text, '-', ''), 16))::bit(64)::bigint as payment_id,
    coalesce(buyer_ap.full_name, buyer.name, 'N/a') as athlete_name,
    ('Package · ' || coalesce(nullif(btrim(pur.custom_name), ''), cpkg.package_name, opkg.name, 'Sessions'))::text as slot_name,
    coalesce(coach.name, org.name, 'N/a') as coach_name,
    round(pur.total_amount, 2) as coach_offer_amount,
    0::numeric as platform_fee,
    pur.stripe_fee::numeric as stripe_fee,
    coalesce(pur.stripe_net_amount, round(pur.total_amount, 2))::numeric as net_amount,
    coalesce(pur.purchase_date, pur.created_at) as transaction_time,
    'package'::text as payment_kind,
    case
      when coalesce(pur.stripe_payment_intent, pur.stripe_session_id, pur.payment_intent_id) is not null then 'online'
      else 'offline'
    end::text as pay_channel,
    pur.stripe_session_id,
    coalesce(pur.stripe_payment_intent, pur.payment_intent_id) as stripe_payment_intent,
    'paid'::text as payment_status,
    public.involves_test_account(pur.coach_id, null, pur.user_id) as is_test,
    round(pur.total_amount, 2) as gross_amount,
    coalesce(pur.stripe_payment_intent, pur.payment_intent_id, 'PKG-' || left(pur.id::text, 8)) as reference,
    pur.id::text as record_id
  from public.package_purchases as pur
  left join public.coach_packages as cpkg on cpkg.id = pur.package_id
  left join public.org_packages as opkg on opkg.id = pur.org_package_id
  left join public.organizations as org on org.id = pur.organization_id
  left join public.coaches as coach on coach.id = pur.coach_id
  left join public.user_profiles as buyer on buyer.id = pur.user_id
  left join public.athlete_profiles as buyer_ap on buyer_ap.id = buyer.athlete_id
  where pur.camp_signup_id is null
    and pur.invoice_id is null
    and pur.granted_by is null
    and coalesce(pur.total_amount, 0) > 0
    and coalesce(cpkg.kind, 'package') <> 'camp';
$function$;
