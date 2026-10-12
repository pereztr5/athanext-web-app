-- Package in progress (WC4 #24): coach records a package already partway through for a roster
-- athlete (sessions used before AthaNext, price, paid outside or still owed).

alter table public.package_purchases
  add column if not exists prior_used integer not null default 0
    check (prior_used >= 0);

alter table public.package_purchases
  add column if not exists outside text
    check (outside is null or outside in ('paid', 'owed'));

alter table public.package_purchases
  add column if not exists custom_name text;

alter table public.package_purchases
  add column if not exists invoice_id uuid references public.coach_invoices(id) on delete set null;

comment on column public.package_purchases.prior_used is
  'Sessions already used before they joined AthaNext (package in progress).';
comment on column public.package_purchases.outside is
  'paid = already paid outside AthaNext; owed = still owed (invoice linked); null = bought on AthaNext.';

-- Upsert the coach's outside package-in-progress for one athlete.
create or replace function public.upsert_package_in_progress(
  p_athlete_id uuid,
  p_package_id uuid,
  p_custom_name text,
  p_sessions_total integer,
  p_prior_used integer,
  p_price numeric,
  p_outside text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_user uuid;
  v_name text;
  v_total integer;
  v_prior integer;
  v_price numeric;
  v_remaining integer;
  v_id uuid;
  v_invoice uuid;
  v_existing uuid;
begin
  if v_coach is null then
    raise exception 'Only coaches can add packages' using errcode = '42501';
  end if;
  if p_athlete_id is null or p_athlete_id not in (select public.coach_roster_ids(v_coach)) then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;
  if p_outside is null or p_outside not in ('paid', 'owed') then
    raise exception 'Pick paid or owed' using errcode = '22023';
  end if;
  if p_sessions_total is null or p_sessions_total < 1 or p_sessions_total > 200 then
    raise exception 'Enter how many sessions are in the package' using errcode = '22023';
  end if;
  if p_prior_used is null or p_prior_used < 0 or p_prior_used >= p_sessions_total then
    raise exception 'Sessions already used must be less than the package total' using errcode = '22023';
  end if;
  if p_outside = 'owed' then
    if p_price is null or p_price <= 0 or p_price > 10000 then
      raise exception 'Enter an amount between $0.01 and $10,000' using errcode = '22023';
    end if;
    if not public.is_own_client(v_coach, p_athlete_id) then
      raise exception 'Still owed only works for families you invited. Marketplace families buy packages in the app.' using errcode = '22023';
    end if;
  elsif p_price is null or p_price < 0 or p_price > 100000 then
    raise exception 'Enter a price' using errcode = '22023';
  end if;

  select athlete.user_id into v_user from public.athlete_profiles as athlete where athlete.id = p_athlete_id;
  if v_user is null then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;

  v_total := p_sessions_total;
  v_prior := p_prior_used;
  v_price := round(p_price, 2);
  v_remaining := v_total - v_prior;

  if p_package_id is not null then
    select package.package_name into v_name
    from public.coach_packages as package
    where package.id = p_package_id and package.coach_id = v_coach;
    if v_name is null then
      raise exception 'Package not found' using errcode = '22023';
    end if;
  else
    v_name := nullif(left(btrim(coalesce(p_custom_name, '')), 80), '');
    if v_name is null then
      raise exception 'Name the package' using errcode = '22023';
    end if;
  end if;

  select purchase.id into v_existing
  from public.package_purchases as purchase
  where purchase.coach_id = v_coach
    and purchase.user_id = v_user
    and purchase.outside is not null
    and purchase.status = 'active'
  order by purchase.purchase_date desc
  limit 1
  for update;

  if p_outside = 'owed' then
    if v_existing is not null then
      select purchase.invoice_id into v_invoice from public.package_purchases as purchase where purchase.id = v_existing;
    end if;
    if v_invoice is null then
      v_invoice := public.create_coach_invoice(
        p_athlete_id,
        coalesce(v_name, 'Package') || ' (from before AthaNext)',
        v_price,
        (current_date + 14),
        'Package started before AthaNext'
      );
    else
      update public.coach_invoices
      set amount = v_price, service = left(coalesce(v_name, 'Package') || ' (from before AthaNext)', 120)
      where id = v_invoice and status = 'open';
    end if;
  elsif v_existing is not null then
    select purchase.invoice_id into v_invoice from public.package_purchases as purchase where purchase.id = v_existing;
    if v_invoice is not null then
      update public.coach_invoices
      set status = 'paid', paid_at = coalesce(paid_at, now()), paid_method = 'outside'
      where id = v_invoice and status = 'open';
    end if;
    v_invoice := null;
  end if;

  if v_existing is not null then
    update public.package_purchases set
      package_id = p_package_id,
      custom_name = case when p_package_id is null then v_name else null end,
      sessions_total = v_total,
      sessions_remaining = v_remaining,
      prior_used = v_prior,
      total_amount = v_price,
      outside = p_outside,
      invoice_id = v_invoice,
      -- Far date so roster credits (expiry_date >= current_date) and booking credits both count.
      expiry_date = (current_date + 3650),
      updated_at = now()
    where id = v_existing;
    return v_existing;
  end if;

  insert into public.package_purchases (
    coach_id, user_id, package_id, source, sessions_total, sessions_remaining,
    total_amount, status, purchase_date, expiry_date, prior_used, outside, custom_name, invoice_id
  ) values (
    v_coach, v_user, p_package_id, 'package', v_total, v_remaining,
    v_price, 'active', now(), (current_date + 3650), v_prior, p_outside,
    case when p_package_id is null then v_name else null end,
    v_invoice
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.upsert_package_in_progress(uuid, uuid, text, integer, integer, numeric, text) from public, anon;
grant execute on function public.upsert_package_in_progress(uuid, uuid, text, integer, integer, numeric, text) to authenticated;

-- Extend athlete page with the package-in-progress card payload.
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
    'goal', (select nullif(trim(athlete.season_goal), '') from public.athlete_profiles as athlete where athlete.id = p_athlete_id),
    'video', (select nullif(trim(athlete.highlight_video_url), '') from public.athlete_profiles as athlete where athlete.id = p_athlete_id),
    'relation', (
      select account.guardian_relationship
      from public.athlete_profiles as athlete
      join public.user_profiles as account on account.id = athlete.user_id
      where athlete.id = p_athlete_id
    ),
    'packageExpires', (
      select purchase.expiry_date
      from public.athlete_profiles as athlete
      join public.package_purchases as purchase on purchase.user_id = athlete.user_id
      join public.coach_packages as package on package.id = purchase.package_id
      where athlete.id = p_athlete_id
        and purchase.coach_id = v_coach
        and purchase.status not in ('canceled', 'cancelled', 'refunded')
      order by (purchase.expiry_date >= current_date and purchase.sessions_remaining > 0) desc,
        purchase.purchase_date desc
      limit 1
    ),
    'packageProgress', (
      select jsonb_build_object(
        'id', purchase.id,
        'name', coalesce(purchase.custom_name, package.package_name, 'Package'),
        'packageId', purchase.package_id,
        'total', purchase.sessions_total,
        'remaining', purchase.sessions_remaining,
        'prior', purchase.prior_used,
        'price', purchase.total_amount,
        'outside', purchase.outside,
        'boughtAt', purchase.purchase_date,
        'invoiceId', purchase.invoice_id
      )
      from public.athlete_profiles as athlete
      join public.package_purchases as purchase on purchase.user_id = athlete.user_id
      left join public.coach_packages as package on package.id = purchase.package_id
      where athlete.id = p_athlete_id
        and purchase.coach_id = v_coach
        and purchase.status = 'active'
        and purchase.sessions_remaining > 0
      order by (purchase.outside is not null) desc, purchase.purchase_date desc
      limit 1
    ),
    'due', (
      select jsonb_build_object(
        'amount', sum(invoice.amount),
        'invoiceId', (array_agg(invoice.id order by invoice.due_date, invoice.created_at))[1],
        'reminders', (array_agg(invoice.reminders order by invoice.due_date, invoice.created_at))[1]
      )
      from public.coach_invoices as invoice
      where invoice.coach_id = v_coach and invoice.athlete_id = p_athlete_id and invoice.status = 'open'
      having count(*) > 0
    ),
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
        'status', booking.status,
        'hasFeedback', feedback.id is not null,
        'noShow', coalesce(feedback.no_show, false) or attendance.attendance in ('absent', 'no_show'),
        'summary', case when coalesce(feedback.no_show, false) then null else feedback.summary end,
        'note', note.feedback_to_athlete
      ) order by occ.occurrence_date desc, occ.start_time desc)
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
      left join public.session_feedback_v2 as feedback on feedback.slot_id = occ.id
      left join public.slot_attendance_v2 as attendance on attendance.booking_id = booking.id
      left join public.slot_feedback_v2 as note on note.booking_id = booking.id
      where booking.coach_id = v_coach and booking.athlete_id = p_athlete_id
        and booking.status in ('pending_payment', 'booked', 'completed', 'no_show')
        and public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
    ), '[]'::jsonb)
  );
end;
$$;
