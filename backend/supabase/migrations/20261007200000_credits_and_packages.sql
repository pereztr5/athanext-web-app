-- Credits and packages (ATH-94, ATH-77).
-- * Package purchases complete in the app; the coach is paid the whole package at purchase.
-- * Credits (package sessions, and sessions cancelled with 24 hours' notice) are used first
--   when booking with that coach. A cancellation credit is with that coach and lasts 90 days.
-- * Request card holds (ATH-85) need the 'authorized' and 'released' payment states.

alter table public.coach_slot_bookings drop constraint bookings_v3_payment_status;
alter table public.coach_slot_bookings add constraint bookings_v3_payment_status check (
  payment_status = any (array['unpaid', 'requires_action', 'paid', 'refunded', 'direct', 'authorized', 'released', 'credit', 'outside'])
);

alter table public.coach_slot_bookings add column credit_purchase_id uuid references public.package_purchases(id) on delete set null;

alter table public.package_purchases alter column package_id drop not null;
alter table public.package_purchases add column source text not null default 'package' check (source in ('package', 'cancel_credit'));
alter table public.package_purchases add column source_booking_id uuid references public.coach_slot_bookings(id) on delete set null;
create unique index package_purchases_stripe_session on public.package_purchases (stripe_session_id) where stripe_session_id is not null;

-- Package money goes out like a paid session.
alter table public.payout_transfers add column package_purchase_id uuid references public.package_purchases(id) on delete cascade;
alter table public.payout_transfers drop constraint payout_transfers_source;
alter table public.payout_transfers add constraint payout_transfers_source check (
  num_nonnulls(booking_id, invoice_id, package_purchase_id) = 1
);
create unique index payout_transfers_package_kind on public.payout_transfers (package_purchase_id, kind) where package_purchase_id is not null;

-- Uses one credit for a booking: the credit that expires first. Service role (checkout).
create or replace function public.redeem_coach_credit(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.coach_slot_bookings%rowtype;
  v_purchase uuid;
begin
  select * into v_booking from public.coach_slot_bookings where id = p_booking_id;
  if not found then return null; end if;
  select purchase.id into v_purchase
  from public.package_purchases purchase
  join public.athlete_profiles athlete on athlete.user_id = purchase.user_id
  where purchase.coach_id = v_booking.coach_id and athlete.id = v_booking.athlete_id
    and purchase.status = 'active' and purchase.sessions_remaining > 0
    and (purchase.expiry_date is null or purchase.expiry_date > now())
  order by purchase.expiry_date nulls last, purchase.created_at
  limit 1
  for update of purchase skip locked;
  if v_purchase is null then return null; end if;
  update public.package_purchases set sessions_remaining = sessions_remaining - 1, updated_at = now() where id = v_purchase;
  update public.coach_slot_bookings set credit_purchase_id = v_purchase, payment_status = 'credit', updated_at = now() where id = p_booking_id;
  return v_purchase;
end;
$$;

-- Family cancels a session. With 24 hours' notice a paid or credit session comes back as a
-- credit with that coach (90 days); a credit that is still valid is simply returned.
-- Requests and unpaid bookings are just cancelled. Returns { credit: boolean }.
create or replace function public.cancel_my_booking(p_booking_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.coach_slot_bookings%rowtype;
  v_starts timestamptz;
  v_user uuid;
  v_credit boolean := false;
begin
  select b.* into v_booking
  from public.coach_slot_bookings b
  join public.athlete_profiles a on a.id = b.athlete_id
  where b.id = p_booking_id and (a.user_id = auth.uid() or b.created_by = auth.uid())
  for update of b;
  if not found then
    raise exception 'Booking not found' using errcode = '42501';
  end if;
  if v_booking.status not in ('booked', 'pending_payment', 'requested') then
    raise exception 'This session can no longer be cancelled' using errcode = '22023';
  end if;
  select public.eastern_timestamp(occ.occurrence_date, occ.start_time) into v_starts
  from public.coach_availability_slot_occurrences occ where occ.id = v_booking.occurrence_id;
  if v_starts <= now() then
    raise exception 'This session has already started' using errcode = '22023';
  end if;

  if v_booking.status = 'booked' and v_booking.payment_status in ('paid', 'credit') and v_starts - now() >= interval '24 hours' then
    select user_id into v_user from public.athlete_profiles where id = v_booking.athlete_id;
    if v_booking.payment_status = 'credit' and exists (
      select 1 from public.package_purchases
      where id = v_booking.credit_purchase_id and status = 'active' and (expiry_date is null or expiry_date > now())
    ) then
      update public.package_purchases set sessions_remaining = least(sessions_total, sessions_remaining + 1), updated_at = now()
      where id = v_booking.credit_purchase_id;
    else
      insert into public.package_purchases (
        coach_id, user_id, package_id, source, source_booking_id, sessions_total, sessions_remaining,
        status, purchase_date, expiry_date, total_amount
      ) values (
        v_booking.coach_id, v_user, null, 'cancel_credit', v_booking.id, 1, 1,
        'active', now(), now() + interval '90 days', 0
      );
    end if;
    v_credit := true;
  end if;

  update public.coach_slot_bookings
  set status = 'canceled', canceled_at = now(), updated_at = now(),
      cancellation_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Cancelled by the family')
  where id = p_booking_id;
  return jsonb_build_object('credit', v_credit);
end;
$$;

-- Package shares (the whole package goes to the coach, org share included). Service role.
create or replace function public.plan_package_transfers(p_purchase_id uuid)
returns setof public.payout_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.package_purchases%rowtype;
  v_member public.organization_coaches%rowtype;
  v_owner uuid;
  v_rate numeric;
  v_org_amount numeric := 0;
begin
  select * into v_p from public.package_purchases where id = p_purchase_id;
  if not found or v_p.source <> 'package' or v_p.status <> 'active' or coalesce(v_p.total_amount, 0) <= 0 then
    return;
  end if;
  select * into v_member from public.organization_coaches
  where coach_id = v_p.coach_id and rate is not null and joined_at <= v_p.created_at;
  if found then
    select owner_coach_id into v_owner from public.organizations where id = v_member.organization_id;
    select h.rate into v_rate from public.organization_rate_history h
    where h.organization_id = v_member.organization_id and h.coach_id = v_p.coach_id and h.effective_from <= v_p.created_at
    order by h.effective_from desc limit 1;
    v_org_amount := round(v_p.total_amount * coalesce(v_rate, v_member.rate) / 100, 2);
  end if;
  insert into public.payout_transfers (package_purchase_id, kind, coach_id, amount)
  values (v_p.id, 'coach', v_p.coach_id, v_p.total_amount - v_org_amount)
  on conflict do nothing;
  if v_org_amount > 0 then
    insert into public.payout_transfers (package_purchase_id, kind, coach_id, organization_id, amount)
    values (v_p.id, 'org', v_owner, v_member.organization_id, v_org_amount)
    on conflict do nothing;
  end if;
  return query select * from public.payout_transfers where package_purchase_id = v_p.id;
end;
$$;

revoke all on function public.redeem_coach_credit(uuid) from public, anon, authenticated;
grant execute on function public.redeem_coach_credit(uuid) to service_role;
grant execute on function public.coach_credits_left(uuid, uuid) to service_role;
revoke all on function public.cancel_my_booking(uuid, text) from public, anon;
grant execute on function public.cancel_my_booking(uuid, text) to authenticated;
revoke all on function public.plan_package_transfers(uuid) from public, anon, authenticated;
grant execute on function public.plan_package_transfers(uuid) to service_role;
