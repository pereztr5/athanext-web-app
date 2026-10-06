-- ATH-74: coach My Athletes. The roster and athlete page read through these functions.
-- Gear orders land in gear_purchases when Shopify reports a paid order.

create table public.gear_purchases (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  coach_id uuid references public.coaches (id) on delete set null,
  shopify_order_id text not null,
  shopify_line_id text not null default '',
  title text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  -- Refunds from refunds/create, never more than amount.
  refunded_amount numeric(10, 2) not null default 0 check (refunded_amount >= 0 and refunded_amount <= amount),
  currency text not null default 'USD',
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (shopify_order_id, shopify_line_id)
);

create index gear_purchases_athlete_idx on public.gear_purchases (athlete_id);

alter table public.gear_purchases enable row level security;
revoke all on public.gear_purchases from public, anon, authenticated;

create table public.coach_athlete_notes (
  coach_id uuid not null references public.coaches (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  private_note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (coach_id, athlete_id),
  constraint coach_athlete_notes_length check (char_length(private_note) <= 2000)
);

alter table public.coach_athlete_notes enable row level security;
revoke all on public.coach_athlete_notes from public, anon, authenticated;

-- Anyone with a live or past booking with the coach, or who accepted their invite.
-- Declined and expired requests on their own don't put a family on the roster.
create or replace function public.coach_roster_ids(p_coach_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select booking.athlete_id
  from public.coach_slot_bookings as booking
  where booking.coach_id = p_coach_id
    and booking.status in ('requested', 'pending_payment', 'booked', 'completed', 'no_show')
  union
  select referral.athlete_id
  from public.coach_client_referrals as referral
  where referral.coach_id = p_coach_id
    and referral.status = 'confirmed'
    and referral.athlete_id is not null;
$$;

revoke all on function public.coach_roster_ids(uuid) from public, anon, authenticated;

create or replace function public.get_coach_roster()
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
    raise exception 'Only coaches can see their athletes' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(r)::jsonb order by r.name)
    from (
      select
        athlete.id,
        athlete.full_name as name,
        athlete.profile_image_url as "imageUrl",
        extract(year from age(current_date, athlete.date_of_birth))::int as age,
        athlete.position,
        nullif(athlete.high_school, '') as team,
        account.name as "accountName",
        account.email,
        account.phone_number as phone,
        public.is_coach_client(v_coach, athlete.id) as "isClient",
        coalesce(
          (select min(booking.created_at)::date from public.coach_slot_bookings as booking
            where booking.coach_id = v_coach and booking.athlete_id = athlete.id),
          athlete.created_at::date
        ) as "joinedOn",
        coalesce((
          select jsonb_agg(distinct occ.pillar_slot) filter (where occ.pillar_slot is not null)
          from public.coach_slot_bookings as booking
          join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
          where booking.coach_id = v_coach and booking.athlete_id = athlete.id
        ), '[]'::jsonb) as pillars,
        (
          select jsonb_build_object('date', occ.occurrence_date, 'startTime', occ.start_time, 'place', coalesce(occ.place, occ.location))
          from public.coach_slot_bookings as booking
          join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
          where booking.coach_id = v_coach and booking.athlete_id = athlete.id
            and booking.status in ('booked', 'pending_payment', 'requested')
            and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
          order by occ.occurrence_date, occ.start_time
          limit 1
        ) as next,
        (
          select occ.occurrence_date
          from public.coach_slot_bookings as booking
          join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
          where booking.coach_id = v_coach and booking.athlete_id = athlete.id
            and booking.status in ('booked', 'completed')
            and public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
          order by occ.occurrence_date desc, occ.start_time desc
          limit 1
        ) as "lastDate",
        coalesce((
          select sum(purchase.sessions_remaining)::int
          from public.package_purchases as purchase
          where purchase.coach_id = v_coach
            and purchase.user_id = athlete.user_id
            and purchase.expiry_date >= current_date
            and purchase.sessions_remaining > 0
            and purchase.status not in ('canceled', 'cancelled', 'refunded')
        ), 0) as credits,
        pkg.name as "packageName",
        pkg.sessions_total as "packageTotal",
        case when pkg.id is null then null else pkg.sessions_total - pkg.sessions_remaining end as "packageUsed",
        (
          select count(*)::int
          from public.coach_slot_bookings as booking
          join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
          where booking.coach_id = v_coach and booking.athlete_id = athlete.id
            and booking.status in ('booked', 'completed')
            and public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
        ) as "sessionsCount",
        coalesce((
          select sum(occ.price)
          from public.coach_slot_bookings as booking
          join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
          where booking.coach_id = v_coach and booking.athlete_id = athlete.id
            and booking.payment_status = 'paid'
            and booking.status in ('booked', 'completed')
        ), 0) + coalesce((
          select sum(purchase.total_amount)
          from public.package_purchases as purchase
          where purchase.coach_id = v_coach
            and purchase.user_id = athlete.user_id
            and purchase.status not in ('canceled', 'cancelled', 'refunded')
        ), 0) as spent,
        coalesce((
          select sum(gear.amount - gear.refunded_amount)
          from public.gear_purchases as gear
          where gear.athlete_id = athlete.id
            and (gear.coach_id is null or gear.coach_id = v_coach)
        ), 0) as "gearTotal"
      from public.athlete_profiles as athlete
      left join public.user_profiles as account on account.id = athlete.user_id
      left join lateral (
        select purchase.id, package.package_name as name, purchase.sessions_total, purchase.sessions_remaining
        from public.package_purchases as purchase
        join public.coach_packages as package on package.id = purchase.package_id
        where purchase.coach_id = v_coach
          and purchase.user_id = athlete.user_id
          and purchase.status not in ('canceled', 'cancelled', 'refunded')
        order by (purchase.expiry_date >= current_date and purchase.sessions_remaining > 0) desc,
          purchase.purchase_date desc
        limit 1
      ) as pkg on true
      where athlete.id in (select public.coach_roster_ids(v_coach))
    ) as r
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_coach_roster() from public, anon;
grant execute on function public.get_coach_roster() to authenticated;

create or replace function public.get_coach_athlete(p_athlete_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_row jsonb;
begin
  if v_coach is null then
    raise exception 'Only coaches can see their athletes' using errcode = '42501';
  end if;
  if p_athlete_id is null or p_athlete_id not in (select public.coach_roster_ids(v_coach)) then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;

  select value into v_row
  from jsonb_array_elements(public.get_coach_roster()) as value
  where value->>'id' = p_athlete_id::text;

  return jsonb_build_object(
    'athlete', v_row,
    'note', coalesce((
      select note.private_note from public.coach_athlete_notes as note
      where note.coach_id = v_coach and note.athlete_id = p_athlete_id
    ), ''),
    'upcoming', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', occ.id,
        'date', occ.occurrence_date,
        'startTime', occ.start_time,
        'endTime', occ.end_time,
        'name', case when occ.session_type = 'group' then occ.session_name else coalesce(occ.pillar_slot, '1-on-1') end,
        'pillar', occ.pillar_slot,
        'kind', occ.session_type,
        'place', coalesce(occ.place, occ.location),
        'price', occ.price,
        'status', booking.status
      ) order by occ.occurrence_date, occ.start_time)
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
      where booking.coach_id = v_coach and booking.athlete_id = p_athlete_id
        and booking.status in ('booked', 'pending_payment', 'requested')
        and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
    ), '[]'::jsonb),
    'past', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', occ.id,
        'date', occ.occurrence_date,
        'startTime', occ.start_time,
        'endTime', occ.end_time,
        'name', case when occ.session_type = 'group' then occ.session_name else coalesce(occ.pillar_slot, '1-on-1') end,
        'pillar', occ.pillar_slot,
        'kind', occ.session_type,
        'place', coalesce(occ.place, occ.location),
        'price', occ.price,
        'status', booking.status
      ) order by occ.occurrence_date desc, occ.start_time desc)
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
      where booking.coach_id = v_coach and booking.athlete_id = p_athlete_id
        and booking.status in ('booked', 'completed')
        and public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
    ), '[]'::jsonb),
    'gear', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', gear.title,
        'amount', gear.amount - gear.refunded_amount,
        'refunded', gear.refunded_amount > 0,
        'purchasedAt', gear.purchased_at
      ) order by gear.purchased_at desc)
      from public.gear_purchases as gear
      where gear.athlete_id = p_athlete_id
        and (gear.coach_id is null or gear.coach_id = v_coach)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_coach_athlete(uuid) from public, anon;
grant execute on function public.get_coach_athlete(uuid) to authenticated;

create or replace function public.set_coach_athlete_note(p_athlete_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_note text := left(trim(coalesce(p_note, '')), 2000);
begin
  if v_coach is null then
    raise exception 'Only coaches can keep notes' using errcode = '42501';
  end if;
  if p_athlete_id is null or p_athlete_id not in (select public.coach_roster_ids(v_coach)) then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;
  insert into public.coach_athlete_notes (coach_id, athlete_id, private_note)
    values (v_coach, p_athlete_id, v_note)
    on conflict (coach_id, athlete_id) do update
      set private_note = excluded.private_note, updated_at = now();
end;
$$;

revoke all on function public.set_coach_athlete_note(uuid, text) from public, anon;
grant execute on function public.set_coach_athlete_note(uuid, text) to authenticated;

-- Next open 1-on-1 times, with the athlete's usual weekday and start marked.
create or replace function public.get_roster_open_times(p_athlete_id uuid)
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
      limit 8
    ) as occ
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_roster_open_times(uuid) from public, anon;
grant execute on function public.get_roster_open_times(uuid) to authenticated;
