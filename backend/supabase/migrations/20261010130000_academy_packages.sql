-- Academy packages (Working Copy, Organization page): the org owner sells packages that work
-- with some or all of the org's coaches, e.g. "8 sessions with any on-field coach, $600".
--
-- Money is paid per session used (decided 2026-10-10):
-- * The family pays the package through Stripe and gets credits valid with the listed coaches:
--   1-on-1 packages for 1-on-1 sessions, group passes (renew monthly) for group sessions.
-- * Nothing is paid out at purchase. Once a session booked with an academy credit has taken
--   place, it counts as paid at the package's per-session price and is split like any paid
--   session: the coach's share, and the org share at the coach's org rate (the owner keeps 100%
--   of their own sessions).
-- * Credits that expire unused go to the org owner.

create table public.org_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('individual', 'group')),
  session_count integer not null check (session_count between 1 and 100),
  -- Dollars, like session prices.
  price numeric(10, 2) not null check (price > 0),
  validity_days integer not null default 90 check (validity_days between 1 and 730),
  renews_monthly boolean not null default false,
  coach_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index org_packages_org on public.org_packages (organization_id) where is_active;

alter table public.org_packages enable row level security;
revoke all on public.org_packages from public, anon, authenticated;

-- A purchase is with one coach (coach packages) or with an academy package.
alter table public.package_purchases alter column coach_id drop not null;
alter table public.package_purchases add column org_package_id uuid references public.org_packages(id) on delete set null;
alter table public.package_purchases add column organization_id uuid references public.organizations(id) on delete set null;
alter table public.package_purchases add column stripe_subscription_id text;
alter table public.package_purchases add constraint package_purchases_owner check (coach_id is not null or org_package_id is not null);
create unique index package_purchases_subscription_period
  on public.package_purchases (stripe_subscription_id, purchase_date) where stripe_subscription_id is not null;

-- Unused academy credits paid to the owner when they expire.
alter table public.payout_transfers add column settled_unused boolean not null default false;

-- ---------- Owner: list, save and remove packages ----------

create or replace function public.org_package_json(p public.org_packages)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'kind', p.kind,
    'session_count', p.session_count,
    'price', p.price,
    'validity_days', p.validity_days,
    'renews_monthly', p.renews_monthly,
    'coach_ids', to_jsonb(p.coach_ids)
  );
$$;
revoke all on function public.org_package_json(public.org_packages) from public, anon, authenticated;

create or replace function public.get_my_org_packages()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.org_package_json(p) order by p.price), '[]'::jsonb)
  from public.org_packages p
  where p.organization_id = public.my_organization_id() and p.is_active;
$$;

create or replace function public.save_org_package(
  p_id uuid, p_name text, p_kind text, p_session_count integer, p_price numeric, p_validity_days integer, p_coach_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.my_organization_id();
  v_coaches uuid[];
  v_row public.org_packages%rowtype;
begin
  if v_org is null then
    raise exception 'Only the organization owner can edit academy packages' using errcode = '42501';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'Name the package' using errcode = '22023';
  end if;
  if p_kind not in ('individual', 'group') then
    raise exception 'Pick 1-on-1 or group sessions' using errcode = '22023';
  end if;
  -- Only coaches who are in the org.
  select coalesce(array_agg(distinct m.coach_id), '{}') into v_coaches
  from public.organization_coaches m
  where m.organization_id = v_org and m.coach_id = any (coalesce(p_coach_ids, '{}'));
  if cardinality(v_coaches) = 0 then
    raise exception 'Pick at least one coach' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.org_packages (organization_id, name, kind, session_count, price, validity_days, renews_monthly, coach_ids)
    values (v_org, left(btrim(p_name), 80), p_kind, p_session_count, round(p_price, 2), coalesce(p_validity_days, 90), p_kind = 'group', v_coaches)
    returning * into v_row;
  else
    update public.org_packages set
      name = left(btrim(p_name), 80),
      kind = p_kind,
      session_count = p_session_count,
      price = round(p_price, 2),
      validity_days = coalesce(p_validity_days, 90),
      renews_monthly = p_kind = 'group',
      coach_ids = v_coaches,
      updated_at = now()
    where id = p_id and organization_id = v_org and is_active
    returning * into v_row;
    if not found then
      raise exception 'Package not found' using errcode = '42501';
    end if;
  end if;
  return public.org_package_json(v_row);
end;
$$;

-- Removing hides the package; credits families already bought keep working.
create or replace function public.remove_org_package(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.org_packages set is_active = false, updated_at = now()
  where id = p_id and organization_id = public.my_organization_id();
  if not found then
    raise exception 'Package not found' using errcode = '42501';
  end if;
end;
$$;

-- Undo for a remove.
create or replace function public.restore_org_package(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.org_packages set is_active = true, updated_at = now()
  where id = p_id and organization_id = public.my_organization_id();
end;
$$;

-- ---------- Families: org page and coach profiles ----------

-- The org page: active packages and upcoming group sessions by the coaches on the page.
-- Single prices (each coach's 1-on-1 rate, each group's price) let the page show the saving.
create or replace function public.get_org_page_extras(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with org as (select * from public.organizations where slug = p_slug),
  shown as (
    select m.coach_id from public.organization_coaches m join org on org.id = m.organization_id
    join public.coaches c on c.id = m.coach_id
    where m.shown and c.deactivated_at is null
  )
  select jsonb_build_object(
    'owner_id', (select owner_coach_id from org),
    'owner_name', (select c.name from public.coaches c join org on c.id = org.owner_coach_id),
    'packages', coalesce((
      select jsonb_agg(public.org_package_json(p) order by p.price)
      from public.org_packages p join org on org.id = p.organization_id
      where p.is_active
    ), '[]'::jsonb),
    'coach_prices', coalesce((
      select jsonb_object_agg(c.id, c.hourly_rate)
      from public.coaches c join public.organization_coaches m on m.coach_id = c.id join org on org.id = m.organization_id
    ), '{}'::jsonb),
    'groups', coalesce((
      select jsonb_agg(g order by g->>'date', g->>'start_time')
      from (
        select jsonb_build_object(
          'id', occ.id,
          'coach_id', occ.coach_id,
          'coach_name', c.name,
          'title', occ.session_name,
          'date', occ.occurrence_date,
          'start_time', occ.start_time,
          'price', occ.price,
          'capacity', occ.max_bookings_per_slot,
          'booked', (
            select count(*) from public.coach_slot_bookings b
            where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
          )
        ) as g
        from public.coach_availability_slot_occurrences occ
        join public.coaches c on c.id = occ.coach_id
        where occ.coach_id in (select coach_id from shown)
          and occ.session_type = 'group' and occ.is_enabled and not occ.is_draft
          and occ.visibility <> 'offered'
          and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
        order by occ.occurrence_date, occ.start_time
        limit 4
      ) as upcoming
    ), '[]'::jsonb)
  );
$$;

-- Academy packages that include a coach, for that coach's profile ("With {org}").
create or replace function public.get_coach_org_packages(p_coach_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.org_package_json(p) || jsonb_build_object(
      'org_name', o.name,
      'org_slug', o.slug,
      -- For the saving line: each included coach's 1-on-1 price and upcoming group prices.
      'coach_prices', coalesce((select jsonb_object_agg(c.id, c.hourly_rate) from public.coaches c where c.id = any (p.coach_ids)), '{}'::jsonb),
      'group_prices', coalesce((
        select jsonb_agg(distinct occ.price)
        from public.coach_availability_slot_occurrences occ
        where occ.coach_id = any (p.coach_ids) and occ.session_type = 'group' and occ.is_enabled and not occ.is_draft
          and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
      ), '[]'::jsonb)
    ) order by p.price), '[]'::jsonb)
  from public.org_packages p
  join public.organizations o on o.id = p.organization_id
  where p.is_active and p_coach_id = any (p.coach_ids);
$$;

-- ---------- Credits ----------

-- Credits a family can use with a coach: their own packages, cancellation credits, and
-- 1-on-1 academy credits that include the coach. Group passes are counted separately.
create or replace function public.coach_credits_left(p_coach_id uuid, p_athlete_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(purchase.sessions_remaining), 0)::integer
  from public.package_purchases as purchase
  join public.athlete_profiles as athlete on athlete.user_id = purchase.user_id
  left join public.org_packages as pkg on pkg.id = purchase.org_package_id
  where athlete.id = p_athlete_id
    and purchase.status = 'active'
    and coalesce(purchase.sessions_remaining, 0) > 0
    and (purchase.expiry_date is null or purchase.expiry_date > now())
    and (
      purchase.coach_id = p_coach_id
      or (purchase.org_package_id is not null and pkg.kind = 'individual' and p_coach_id = any (pkg.coach_ids))
    );
$$;

-- Credits by kind for checkout: the coach's own (any session), academy 1-on-1 and group passes.
create or replace function public.coach_credit_counts(p_coach_id uuid, p_athlete_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'own', coalesce(sum(purchase.sessions_remaining) filter (where purchase.coach_id = p_coach_id), 0),
    'individual', coalesce(sum(purchase.sessions_remaining) filter (where purchase.coach_id is null and pkg.kind = 'individual'), 0),
    'group', coalesce(sum(purchase.sessions_remaining) filter (where purchase.coach_id is null and pkg.kind = 'group'), 0)
  )
  from public.package_purchases as purchase
  join public.athlete_profiles as athlete on athlete.user_id = purchase.user_id
  left join public.org_packages as pkg on pkg.id = purchase.org_package_id
  where athlete.id = p_athlete_id
    and purchase.status = 'active'
    and coalesce(purchase.sessions_remaining, 0) > 0
    and (purchase.expiry_date is null or purchase.expiry_date > now())
    and (purchase.coach_id = p_coach_id or (purchase.org_package_id is not null and p_coach_id = any (pkg.coach_ids)));
$$;

-- Uses one credit for a booking: a matching credit that expires first. Academy credits only
-- cover sessions of their kind with their coaches. Service role (checkout).
create or replace function public.redeem_coach_credit(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.coach_slot_bookings%rowtype;
  v_type text;
  v_purchase uuid;
begin
  select * into v_booking from public.coach_slot_bookings where id = p_booking_id;
  if not found then return null; end if;
  select occ.session_type into v_type from public.coach_availability_slot_occurrences occ where occ.id = v_booking.occurrence_id;
  select purchase.id into v_purchase
  from public.package_purchases purchase
  join public.athlete_profiles athlete on athlete.user_id = purchase.user_id
  left join public.org_packages pkg on pkg.id = purchase.org_package_id
  where athlete.id = v_booking.athlete_id
    and purchase.status = 'active' and purchase.sessions_remaining > 0
    and (purchase.expiry_date is null or purchase.expiry_date > now())
    and (
      purchase.coach_id = v_booking.coach_id
      or (purchase.org_package_id is not null and v_booking.coach_id = any (pkg.coach_ids) and pkg.kind = coalesce(v_type, 'individual'))
    )
  -- The coach's own credits first, then academy credits, soonest to expire first.
  order by (purchase.coach_id = v_booking.coach_id) desc nulls last, purchase.expiry_date nulls last, purchase.created_at
  limit 1
  for update of purchase skip locked;
  if v_purchase is null then return null; end if;
  update public.package_purchases set sessions_remaining = sessions_remaining - 1, updated_at = now() where id = v_purchase;
  update public.coach_slot_bookings set credit_purchase_id = v_purchase, payment_status = 'credit', updated_at = now() where id = p_booking_id;
  return v_purchase;
end;
$$;

-- ---------- Payouts ----------

-- Academy packages pay nothing at purchase; coach packages keep paying the whole package.
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
  if not found or v_p.org_package_id is not null or v_p.source <> 'package' or v_p.status <> 'active' or coalesce(v_p.total_amount, 0) <= 0 then
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

-- Hourly: sessions booked with an academy credit that have taken place get their shares
-- planned at the package's per-session price. The owner keeps 100% of their own sessions.
-- The shares go out with the coach's normal payouts (the payouts function sends waiting rows).
create or replace function public.plan_academy_credit_transfers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_per numeric;
  v_rate numeric;
  v_org_amount numeric;
  v_n integer := 0;
begin
  for v_row in
    select b.id as booking_id, b.coach_id, b.created_at, p.total_amount, p.sessions_total, p.stripe_charge_id,
           o.id as org_id, o.owner_coach_id
    from public.coach_slot_bookings b
    join public.package_purchases p on p.id = b.credit_purchase_id
    join public.organizations o on o.id = p.organization_id
    join public.coach_availability_slot_occurrences occ on occ.id = b.occurrence_id
    where p.org_package_id is not null
      and b.payment_status = 'credit'
      and b.status in ('booked', 'completed', 'no_show')
      and public.eastern_timestamp(occ.occurrence_date, occ.end_time) <= now()
      and not exists (select 1 from public.payout_transfers t where t.booking_id = b.id)
    limit 500
  loop
    v_per := round(coalesce(v_row.total_amount, 0) / greatest(v_row.sessions_total, 1), 2);
    if v_per <= 0 then continue; end if;
    v_org_amount := 0;
    if v_row.coach_id <> v_row.owner_coach_id then
      select coalesce(
        (select h.rate from public.organization_rate_history h
         where h.organization_id = v_row.org_id and h.coach_id = v_row.coach_id and h.effective_from <= v_row.created_at
         order by h.effective_from desc limit 1),
        (select m.rate from public.organization_coaches m where m.organization_id = v_row.org_id and m.coach_id = v_row.coach_id),
        0) into v_rate;
      v_org_amount := round(v_per * v_rate / 100, 2);
    end if;
    insert into public.payout_transfers (booking_id, kind, coach_id, amount, stripe_charge_id)
    values (v_row.booking_id, 'coach', v_row.coach_id, v_per - v_org_amount, v_row.stripe_charge_id)
    on conflict (booking_id, kind) do nothing;
    if v_org_amount > 0 then
      insert into public.payout_transfers (booking_id, kind, coach_id, organization_id, amount, stripe_charge_id)
      values (v_row.booking_id, 'org', v_row.owner_coach_id, v_row.org_id, v_org_amount, v_row.stripe_charge_id)
      on conflict (booking_id, kind) do nothing;
    end if;
    v_n := v_n + 1;
  end loop;

  -- Expired academy credits that were never used go to the owner.
  for v_row in
    select p.id, p.total_amount, p.sessions_total, p.sessions_remaining, p.stripe_charge_id, o.id as org_id, o.owner_coach_id
    from public.package_purchases p
    join public.organizations o on o.id = p.organization_id
    where p.org_package_id is not null and p.status = 'active' and coalesce(p.sessions_remaining, 0) > 0
      and p.expiry_date is not null and p.expiry_date <= now()
      and not exists (select 1 from public.payout_transfers t where t.package_purchase_id = p.id)
    limit 500
  loop
    v_per := round(coalesce(v_row.total_amount, 0) / greatest(v_row.sessions_total, 1), 2);
    if v_per * v_row.sessions_remaining > 0 then
      insert into public.payout_transfers (package_purchase_id, kind, coach_id, organization_id, amount, stripe_charge_id, settled_unused)
      values (v_row.id, 'org', v_row.owner_coach_id, v_row.org_id, v_per * v_row.sessions_remaining, v_row.stripe_charge_id, true)
      on conflict do nothing;
    end if;
    update public.package_purchases set status = 'expired', updated_at = now() where id = v_row.id;
  end loop;
  return v_n;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'plan-academy-credit-transfers';
select cron.schedule('plan-academy-credit-transfers', '7 * * * *', $$select public.plan_academy_credit_transfers()$$);

-- ---------- Grants ----------
revoke all on function public.get_my_org_packages() from public, anon;
grant execute on function public.get_my_org_packages() to authenticated;
revoke all on function public.save_org_package(uuid, text, text, integer, numeric, integer, uuid[]) from public, anon;
grant execute on function public.save_org_package(uuid, text, text, integer, numeric, integer, uuid[]) to authenticated;
revoke all on function public.remove_org_package(uuid) from public, anon;
grant execute on function public.remove_org_package(uuid) to authenticated;
revoke all on function public.restore_org_package(uuid) from public, anon;
grant execute on function public.restore_org_package(uuid) to authenticated;
grant execute on function public.get_org_page_extras(text) to anon, authenticated;
grant execute on function public.get_coach_org_packages(uuid) to anon, authenticated;
revoke all on function public.coach_credits_left(uuid, uuid) from public, anon, authenticated;
grant execute on function public.coach_credits_left(uuid, uuid) to service_role;
revoke all on function public.coach_credit_counts(uuid, uuid) from public, anon, authenticated;
grant execute on function public.coach_credit_counts(uuid, uuid) to service_role;
revoke all on function public.redeem_coach_credit(uuid) from public, anon, authenticated;
grant execute on function public.redeem_coach_credit(uuid) to service_role;
revoke all on function public.plan_package_transfers(uuid) from public, anon, authenticated;
grant execute on function public.plan_package_transfers(uuid) to service_role;
revoke all on function public.plan_academy_credit_transfers() from public, anon, authenticated;
