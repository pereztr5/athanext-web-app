-- Coach Payments (ATH-89). Marketplace families always pay in the app when they book.
-- Coaches can invoice, or mark as paid (cash or transfer), only families they brought to
-- AthaNext (a confirmed client referral). Families pay invoices by card through Stripe and
-- the money goes to the coach like a paid session (org share included, ATH-90).

create table public.coach_invoices (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  athlete_id uuid references public.athlete_profiles(id) on delete set null,
  family_name text not null default '',
  athlete_name text not null default '',
  service text not null check (length(btrim(service)) between 1 and 120),
  amount numeric(10,2) not null check (amount > 0 and amount <= 10000),
  due_date date not null,
  note text check (note is null or length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  paid_at timestamptz,
  paid_method text check (paid_method in ('card', 'outside')),
  reminders integer not null default 0 check (reminders between 0 and 3),
  last_reminded_at timestamptz,
  stripe_session_id text,
  stripe_payment_intent text,
  created_at timestamptz not null default now()
);
create index coach_invoices_coach on public.coach_invoices (coach_id, status);

alter table public.coach_invoices enable row level security;
create policy "Coaches read their invoices" on public.coach_invoices for select to authenticated
  using (coach_id = public.current_coach_id() or public.has_role(auth.uid(), 'admin'::app_role));
create policy "Families read invoices for their athletes" on public.coach_invoices for select to authenticated
  using (exists (select 1 from public.athlete_profiles a where a.id = athlete_id and a.user_id = auth.uid()));

-- Invoice payments go out like booking payments.
alter table public.payout_transfers alter column booking_id drop not null;
alter table public.payout_transfers add column invoice_id uuid references public.coach_invoices(id) on delete cascade;
alter table public.payout_transfers add constraint payout_transfers_source check ((booking_id is null) <> (invoice_id is null));
create unique index payout_transfers_invoice_kind on public.payout_transfers (invoice_id, kind) where invoice_id is not null;

create or replace function public.is_own_client(p_coach_id uuid, p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_client_referrals
    where coach_id = p_coach_id and athlete_id = p_athlete_id and status = 'confirmed'
  );
$$;

-- Coach: invoices, money in (last 120 days) and which families can be invoiced.
create or replace function public.get_coach_payments()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null then
    raise exception 'Only coaches have payments' using errcode = '42501';
  end if;
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
$$;

create or replace function public.create_coach_invoice(
  p_athlete_id uuid, p_service text, p_amount numeric, p_due date, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_id uuid;
begin
  if v_coach is null then
    raise exception 'Only coaches can send invoices' using errcode = '42501';
  end if;
  if not public.is_own_client(v_coach, p_athlete_id) then
    raise exception 'Only families you brought to AthaNext can be invoiced. Marketplace families pay in the app.' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 10000 then
    raise exception 'Enter an amount' using errcode = '22023';
  end if;
  if p_due is null then
    raise exception 'Pick a due date' using errcode = '22023';
  end if;
  insert into public.coach_invoices (coach_id, athlete_id, family_name, athlete_name, service, amount, due_date, note)
  select v_coach, a.id, coalesce(up.name, a.full_name, ''), coalesce(a.full_name, ''), left(btrim(p_service), 120),
         round(p_amount, 2), p_due, nullif(left(btrim(coalesce(p_note, '')), 500), '')
  from public.athlete_profiles a left join public.user_profiles up on up.id = a.user_id
  where a.id = p_athlete_id
  returning id into v_id;
  return v_id;
end;
$$;

-- Up to 3 reminders per open invoice. Returns the new count.
create or replace function public.remind_coach_invoice(p_invoice_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.coach_invoices set reminders = reminders + 1, last_reminded_at = now()
  where id = p_invoice_id and coach_id = public.current_coach_id() and status = 'open' and reminders < 3
  returning reminders into v_count;
  if v_count is null then
    raise exception 'No more reminders for this invoice' using errcode = '22023';
  end if;
  return v_count;
end;
$$;

-- Paid outside AthaNext (cash or transfer). Only for the coach's own clients, which every
-- invoice already is.
create or replace function public.mark_coach_invoice_paid(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coach_invoices set status = 'paid', paid_at = now(), paid_method = 'outside'
  where id = p_invoice_id and coach_id = public.current_coach_id() and status = 'open';
  if not found then
    raise exception 'This invoice is not open' using errcode = '22023';
  end if;
end;
$$;

-- Family: an invoice for one of their athletes, with the coach's name.
create or replace function public.get_family_invoice(p_invoice_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', i.id, 'coach', c.name, 'athlete', i.athlete_name, 'service', i.service, 'amount', i.amount,
    'due', i.due_date, 'note', i.note, 'status', i.status, 'paid_at', i.paid_at
  )
  from public.coach_invoices i
  join public.coaches c on c.id = i.coach_id
  join public.athlete_profiles a on a.id = i.athlete_id
  where i.id = p_invoice_id and a.user_id = auth.uid();
$$;

-- Shares of a card-paid invoice (service role, from the invoices function).
create or replace function public.plan_invoice_transfers(p_invoice_id uuid)
returns setof public.payout_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.coach_invoices%rowtype;
  v_member public.organization_coaches%rowtype;
  v_owner uuid;
  v_rate numeric;
  v_org_amount numeric := 0;
begin
  select * into v_inv from public.coach_invoices where id = p_invoice_id;
  if not found or v_inv.status <> 'paid' or v_inv.paid_method <> 'card' then
    return;
  end if;
  select * into v_member from public.organization_coaches
  where coach_id = v_inv.coach_id and rate is not null and joined_at <= v_inv.created_at;
  if found then
    select owner_coach_id into v_owner from public.organizations where id = v_member.organization_id;
    select h.rate into v_rate from public.organization_rate_history h
    where h.organization_id = v_member.organization_id and h.coach_id = v_inv.coach_id and h.effective_from <= v_inv.created_at
    order by h.effective_from desc limit 1;
    v_org_amount := round(v_inv.amount * coalesce(v_rate, v_member.rate) / 100, 2);
  end if;
  insert into public.payout_transfers (invoice_id, kind, coach_id, amount)
  values (v_inv.id, 'coach', v_inv.coach_id, v_inv.amount - v_org_amount)
  on conflict do nothing;
  if v_org_amount > 0 then
    insert into public.payout_transfers (invoice_id, kind, coach_id, organization_id, amount)
    values (v_inv.id, 'org', v_owner, v_member.organization_id, v_org_amount)
    on conflict do nothing;
  end if;
  return query select * from public.payout_transfers where invoice_id = v_inv.id;
end;
$$;

revoke all on function public.is_own_client(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_coach_payments() from public, anon;
grant execute on function public.get_coach_payments() to authenticated;
revoke all on function public.create_coach_invoice(uuid, text, numeric, date, text) from public, anon;
grant execute on function public.create_coach_invoice(uuid, text, numeric, date, text) to authenticated;
revoke all on function public.remind_coach_invoice(uuid) from public, anon;
grant execute on function public.remind_coach_invoice(uuid) to authenticated;
revoke all on function public.mark_coach_invoice_paid(uuid) from public, anon;
grant execute on function public.mark_coach_invoice_paid(uuid) to authenticated;
revoke all on function public.get_family_invoice(uuid) from public, anon;
grant execute on function public.get_family_invoice(uuid) to authenticated;
revoke all on function public.plan_invoice_transfers(uuid) from public, anon, authenticated;
grant execute on function public.plan_invoice_transfers(uuid) to service_role;
