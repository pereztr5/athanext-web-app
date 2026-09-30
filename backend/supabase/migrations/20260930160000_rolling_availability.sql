-- ATH-28: scheduling automation.
-- 1. Availability can repeat weekly with no end date. Such periods keep occurrences
--    generated 8 weeks ahead: end_date stays NOT NULL and means "generated through",
--    so existing overlap checks, booking and delete flows keep working unchanged.
-- 2. Booking requests still expire only once their session starts (unchanged); the app
--    reminds the coach about requests waiting over 24h from requested_at.

alter table public.coach_availability
  add column if not exists repeats_weekly boolean not null default false;

comment on column public.coach_availability.repeats_weekly is
  'ATH-28: repeats weekly with no end date. extend_rolling_availability() keeps occurrences 8 weeks ahead and moves end_date forward.';

-- Tops up repeating periods to (Eastern today + 56 days). The last generated week is the
-- template: each enabled occurrence in it repeats every 7 days, so disabled or deleted
-- slots in that week are not brought back. Mirrors upsert_occurrences: one disabled
-- weekly_slots row per occurrence. Dates that would overlap another enabled occurrence
-- are skipped instead of failing the run. Returns the number of occurrences added.
create or replace function public.extend_rolling_availability(p_availability_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('America/New_York', now()))::date;
  v_horizon date := (timezone('America/New_York', now()))::date + 56;
  v_period record;
  v_source record;
  v_date date;
  v_weekly_slot_id uuid;
  v_added integer := 0;
begin
  -- App callers extend one of their own periods; the cron job (no JWT) extends all.
  if auth.uid() is not null and (
    p_availability_id is null
    or not exists (
      select 1
      from public.coach_availability as availability
      join public.user_profiles as profile on profile.coach_id = availability.coach_id
      where availability.id = p_availability_id
        and profile.id = auth.uid()
    )
  ) then
    raise exception 'Availability not found' using errcode = '42501';
  end if;

  for v_period in
    select availability.id, availability.coach_id, availability.end_date
    from public.coach_availability as availability
    where availability.repeats_weekly
      and availability.end_date < v_horizon
      and (p_availability_id is null or availability.id = p_availability_id)
    for update
  loop
    for v_source in
      select occ.*
      from public.coach_availability_slot_occurrences as occ
      where occ.availability_id = v_period.id
        and occ.is_enabled
        and occ.occurrence_date > v_period.end_date - 7
        and occ.occurrence_date <= v_period.end_date
    loop
      v_date := v_source.occurrence_date + 7;
      while v_date <= v_horizon loop
        if v_date >= v_today and not exists (
          select 1
          from public.coach_availability_slot_occurrences as other
          where other.coach_id = v_period.coach_id
            and other.occurrence_date = v_date
            and coalesce(other.is_enabled, true)
            and other.start_time < v_source.end_time
            and v_source.start_time < other.end_time
        ) then
          insert into public.coach_availability_weekly_slots (
            availability_id, day_of_week, session_name, price, duration_minutes, start_time,
            end_time, session_type, location, pillar_slot, is_enabled, max_bookings_per_slot
          ) values (
            v_period.id, extract(isodow from v_date)::smallint, v_source.session_name, v_source.price,
            v_source.duration_minutes, v_source.start_time, v_source.end_time, v_source.session_type,
            v_source.location, v_source.pillar_slot, false, v_source.max_bookings_per_slot
          )
          returning id into v_weekly_slot_id;

          insert into public.coach_availability_slot_occurrences (
            weekly_slot_id, availability_id, coach_id, occurrence_date, session_name, price,
            duration_minutes, start_time, end_time, session_type, location, pillar_slot,
            is_enabled, max_bookings_per_slot
          ) values (
            v_weekly_slot_id, v_period.id, v_period.coach_id, v_date, v_source.session_name,
            v_source.price, v_source.duration_minutes, v_source.start_time, v_source.end_time,
            v_source.session_type, v_source.location, v_source.pillar_slot, true,
            v_source.max_bookings_per_slot
          );
          v_added := v_added + 1;
        end if;
        v_date := v_date + 7;
      end loop;
    end loop;

    update public.coach_availability
      set end_date = v_horizon
      where id = v_period.id;
  end loop;

  return v_added;
end;
$$;

revoke all on function public.extend_rolling_availability(uuid) from public, anon;
grant execute on function public.extend_rolling_availability(uuid) to authenticated;

-- Daily top-up at 05:15 UTC (after midnight Eastern). cron.schedule upserts by job name.
create extension if not exists pg_cron;

select cron.schedule(
  'extend-rolling-availability',
  '15 5 * * *',
  $$select public.extend_rolling_availability()$$
);
