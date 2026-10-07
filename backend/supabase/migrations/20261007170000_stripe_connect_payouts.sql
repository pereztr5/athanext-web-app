-- Coach payouts with Stripe Connect Express. Families still pay AthaNext's Stripe account;
-- as soon as a booking is paid, the coach's share is transferred to their connected account
-- (and an org's share to the org owner's account, ATH-90). Stripe pays it out weekly on the
-- coach's payout day. Transfers wait until the coach finishes setting up payouts.

create table public.coach_payout_accounts (
  coach_id uuid primary key references public.coaches(id) on delete cascade,
  stripe_account_id text not null unique,
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  transfers_active boolean not null default false,
  payout_day text not null default 'monday'
    check (payout_day in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
  bank_last4 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coach_payout_accounts enable row level security;
create policy "Coaches read their payout account" on public.coach_payout_accounts for select to authenticated
  using (coach_id = public.current_coach_id() or public.has_role(auth.uid(), 'admin'::app_role));

-- One row per share of a paid booking: the coach's share, and the org's share when the coach
-- is in an organization. Amounts are what the coach set as the price (families pay AthaNext
-- fees on top), split by the org rate in effect when the booking was made.
create table public.payout_transfers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.coach_slot_bookings(id) on delete cascade,
  kind text not null check (kind in ('coach', 'org')),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'usd',
  status text not null default 'waiting' check (status in ('waiting', 'sent', 'failed')),
  stripe_transfer_id text,
  stripe_charge_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (booking_id, kind)
);
create index payout_transfers_coach on public.payout_transfers (coach_id, status);

alter table public.payout_transfers enable row level security;
create policy "Coaches read their transfers" on public.payout_transfers for select to authenticated
  using (coach_id = public.current_coach_id() or public.has_role(auth.uid(), 'admin'::app_role));

-- Works out the shares of a paid booking. Called by the payouts function with the service role.
create or replace function public.plan_booking_transfers(p_booking_id uuid)
returns setof public.payout_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.coach_slot_bookings%rowtype;
  v_price numeric;
  v_member public.organization_coaches%rowtype;
  v_owner uuid;
  v_rate numeric;
  v_org_amount numeric := 0;
begin
  select * into v_booking from public.coach_slot_bookings where id = p_booking_id;
  if not found or v_booking.payment_status <> 'paid' then
    return;
  end if;
  select coalesce(p.coach_offer_amount, occ.price) into v_price
  from public.coach_availability_slot_occurrences occ
  left join public.payments p on p.booking_id = v_booking.id
  where occ.id = v_booking.occurrence_id;
  if coalesce(v_price, 0) <= 0 then
    return;
  end if;

  select * into v_member from public.organization_coaches
  where coach_id = v_booking.coach_id and rate is not null and joined_at <= v_booking.created_at;
  if found then
    select owner_coach_id into v_owner from public.organizations where id = v_member.organization_id;
    select h.rate into v_rate from public.organization_rate_history h
    where h.organization_id = v_member.organization_id and h.coach_id = v_booking.coach_id
      and h.effective_from <= v_booking.created_at
    order by h.effective_from desc limit 1;
    v_org_amount := round(v_price * coalesce(v_rate, v_member.rate) / 100, 2);
  end if;

  insert into public.payout_transfers (booking_id, kind, coach_id, amount)
  values (v_booking.id, 'coach', v_booking.coach_id, v_price - v_org_amount)
  on conflict (booking_id, kind) do nothing;
  if v_org_amount > 0 then
    insert into public.payout_transfers (booking_id, kind, coach_id, organization_id, amount)
    values (v_booking.id, 'org', v_owner, v_member.organization_id, v_org_amount)
    on conflict (booking_id, kind) do nothing;
  end if;

  return query select * from public.payout_transfers where booking_id = v_booking.id;
end;
$$;

revoke all on function public.plan_booking_transfers(uuid) from public, anon, authenticated;
grant execute on function public.plan_booking_transfers(uuid) to service_role;
