-- ATH-102 / ATH-103: coach SaaS plan at $29/month with a 30-day trial from coaches.created_at.
-- Existing coaches get now() + 30 days so they are not locked on migrate.
-- Unpaid coaches after trial lose write access to coach tools; public profile and family booking stay up.

alter table public.coaches
  add column if not exists trial_ends_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text;

comment on column public.coaches.trial_ends_at is
  'End of free coach product access. New coaches: created_at + 30 days. Existing: backfilled to now() + 30 days.';
comment on column public.coaches.subscription_status is
  'Stripe subscription status: active | trialing | past_due | canceled | unpaid | incomplete | null';

-- New coaches: clock starts at created_at.
create or replace function public.coaches_set_trial_ends_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.trial_ends_at is null then
    new.trial_ends_at := coalesce(new.created_at, now()) + interval '30 days';
  end if;
  return new;
end;
$$;

drop trigger if exists coaches_set_trial_ends_on_insert on public.coaches;
create trigger coaches_set_trial_ends_on_insert
  before insert on public.coaches
  for each row
  execute function public.coaches_set_trial_ends_on_insert();

-- Existing coaches: one grace window from migrate, not from their original created_at.
update public.coaches
set trial_ends_at = now() + interval '30 days'
where trial_ends_at is null;

alter table public.coaches
  alter column trial_ends_at set default (now() + interval '30 days');

-- Paid (active/trialing on Stripe) or still inside the free window.
create or replace function public.coach_has_access(p_coach_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coaches c
    where c.id = coalesce(p_coach_id, public.current_coach_id())
      and (
        c.subscription_status in ('active', 'trialing')
        or (c.trial_ends_at is not null and c.trial_ends_at > now())
      )
  );
$$;

revoke all on function public.coach_has_access(uuid) from public, anon;
grant execute on function public.coach_has_access(uuid) to authenticated, service_role;

create or replace function public.require_coach_billing_access()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_coach_id() is null then
    raise exception 'Only coaches can do this' using errcode = '42501';
  end if;
  if not public.coach_has_access(public.current_coach_id()) then
    raise exception 'Your free plan has ended. Subscribe at $29/month to keep using coach tools.'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.require_coach_billing_access() from public, anon;
grant execute on function public.require_coach_billing_access() to authenticated, service_role;

-- Gate the main create-session write path (same body as 20261005220000, plus billing check).
create or replace function public.schedule_create_sessions(p_session jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_type text := coalesce(p_session->>'session_type', 'individual');
  v_visibility text := coalesce(p_session->>'visibility', 'open');
  v_repeat text := coalesce(p_session->>'repeat', 'none');
  v_weeks integer := coalesce((p_session->>'weeks')::integer, 1);
  v_duration integer := (p_session->>'duration_minutes')::integer;
  v_name text := nullif(trim(p_session->>'session_name'), '');
  v_price numeric := (p_session->>'price')::numeric;
  v_capacity integer := case when v_type = 'group' then coalesce((p_session->>'capacity')::integer, 6) else 1 end;
  v_location text := coalesce(p_session->>'location', 'in-person');
  v_place text := nullif(trim(p_session->>'place'), '');
  v_pillar text := nullif(trim(p_session->>'pillar'), '');
  v_position text := nullif(p_session->>'position', '');
  v_details jsonb := coalesce(p_session->'details', '{}'::jsonb);
  v_draft boolean := coalesce((p_session->>'is_draft')::boolean, false);
  v_offered uuid[] := coalesce(
    (select array_agg(value::uuid) from jsonb_array_elements_text(coalesce(p_session->'offered_to', '[]'::jsonb))),
    '{}'
  );
  v_time jsonb;
  v_date date;
  v_start time;
  v_end time;
  v_series_id uuid;
  v_occ_id uuid;
  v_created uuid[] := '{}';
  v_series uuid[] := '{}';
  v_skipped jsonb := '[]'::jsonb;
  v_planned date;
  v_last date;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can create sessions' using errcode = '42501';
  end if;
  perform public.require_coach_billing_access();
  if v_type not in ('individual', 'group') then
    raise exception 'Unknown session type' using errcode = '22023';
  end if;
  if v_repeat not in ('none', 'weekly', 'weeks') or v_weeks not between 1 and 26 then
    raise exception 'Unknown repeat' using errcode = '22023';
  end if;
  if v_duration is null or v_price is null then
    raise exception 'Length and price are required' using errcode = '22023';
  end if;
  if v_type = 'group' and v_name is null then
    raise exception 'Name the group session' using errcode = '22023';
  end if;
  if v_draft and v_repeat <> 'none' then
    raise exception 'Drafts are one-time sessions' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_session->'times', '[]'::jsonb)) = 0 then
    raise exception 'Pick a time' using errcode = '22023';
  end if;
  v_name := coalesce(v_name, '1-on-1 session');

  for v_time in select * from jsonb_array_elements(p_session->'times') loop
    v_date := (v_time->>'date')::date;
    v_start := (v_time->>'start')::time;
    v_end := v_start + make_interval(mins => v_duration);
    if extract(epoch from v_start) / 60 + v_duration > 24 * 60 then
      raise exception 'Sessions must end before midnight' using errcode = '22023';
    end if;
    if public.eastern_timestamp(v_date, v_start) <= now() then
      raise exception 'Pick a time that hasn''t passed' using errcode = '22023';
    end if;

    if v_repeat = 'none' then
      if v_visibility <> 'open' then
        update public.coach_availability_slot_occurrences as occ
          set is_enabled = false, disabled_reason = 'replaced'
        where occ.coach_id = v_coach_id and occ.occurrence_date = v_date and occ.is_enabled
          and occ.session_type = 'individual' and occ.visibility = 'open'
          and occ.start_time < v_end and v_start < occ.end_time
          and not exists (
            select 1 from public.coach_slot_bookings as b
            where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
          );
      end if;
      if exists (
        select 1 from public.coach_availability_slot_occurrences as other
        where other.coach_id = v_coach_id and other.occurrence_date = v_date and other.is_enabled
          and other.start_time < v_end and v_start < other.end_time
      ) then
        v_skipped := v_skipped || jsonb_build_object('date', v_date, 'start', v_start);
        continue;
      end if;
      insert into public.coach_availability_slot_occurrences (
        coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
        session_type, location, place, pillar_slot, position, visibility, offered_to, details,
        is_draft, is_enabled, max_bookings_per_slot
      ) values (
        v_coach_id, v_date, v_name, v_price, v_duration, v_start, v_end, v_type, v_location,
        v_place, v_pillar, v_position, v_visibility, v_offered, v_details, v_draft, true, v_capacity
      ) returning id into v_occ_id;
      v_created := v_created || v_occ_id;
    else
      v_last := case when v_repeat = 'weeks' then v_date + (v_weeks - 1) * 7 else null end;
      insert into public.coach_session_series (
        coach_id, session_type, day_of_week, start_time, duration_minutes, session_name, price,
        max_bookings_per_slot, location, place, pillar_slot, position, visibility, offered_to,
        details, starts_on, ends_on
      ) values (
        v_coach_id, v_type, extract(isodow from v_date)::smallint, v_start, v_duration, v_name,
        v_price, v_capacity, v_location, v_place, v_pillar, v_position, v_visibility, v_offered,
        v_details, v_date, v_last
      ) returning id into v_series_id;
      v_series := v_series || v_series_id;

      if v_visibility <> 'open' then
        update public.coach_availability_slot_occurrences as occ
          set is_enabled = false, disabled_reason = 'replaced'
        where occ.coach_id = v_coach_id and occ.is_enabled
          and occ.session_type = 'individual' and occ.visibility = 'open'
          and occ.occurrence_date >= v_date
          and (v_last is null or occ.occurrence_date <= v_last)
          and extract(isodow from occ.occurrence_date) = extract(isodow from v_date)
          and occ.start_time < v_end and v_start < occ.end_time
          and not exists (
            select 1 from public.coach_slot_bookings as b
            where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
          );
      end if;

      perform public.fill_session_series(v_series_id);

      v_planned := v_date;
      while v_planned <= coalesce(
        v_last,
        (timezone('America/New_York', now()))::date
          + (select booking_window_weeks from public.coaches where id = v_coach_id) * 7
      ) loop
        if not exists (
          select 1 from public.coach_availability_slot_occurrences
          where series_id = v_series_id and occurrence_date = v_planned
        ) then
          v_skipped := v_skipped || jsonb_build_object('date', v_planned, 'start', v_start);
        end if;
        v_planned := v_planned + 7;
      end loop;

      v_created := v_created || coalesce(
        (select array_agg(id order by occurrence_date) from public.coach_availability_slot_occurrences where series_id = v_series_id),
        '{}'
      );
    end if;
  end loop;

  return jsonb_build_object('created', to_jsonb(v_created), 'series', to_jsonb(v_series), 'skipped', v_skipped);
end;
$$;
