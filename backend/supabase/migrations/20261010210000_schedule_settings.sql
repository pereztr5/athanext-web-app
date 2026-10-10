-- Schedule settings page matching the Working Copy (c-availability).
--
-- 1. coaches gains the booking rules the page shows that had no column yet: free cancellation
--    notice in hours, how far the coach travels (miles from a ZIP) and the group minimum.
--    All nullable: null means "not set" (cancellation falls back to cancellation_policy, then
--    24 hours, in the app).
-- 2. get_schedule_settings: the calling coach's rules, home ZIP and every upcoming day off
--    (get_coach_schedule only returns days off inside its 62-day range).
-- 3. schedule_set_booking_rules: saves all rules in one call. It goes through
--    schedule_set_rules for new-family booking and the booking window, so open weekly series
--    are still refilled when the window changes. schedule_set_rules is unchanged.

alter table public.coaches
  add column if not exists cancel_notice_hours integer,
  add column if not exists travel_miles integer,
  add column if not exists travel_zip text,
  add column if not exists group_min integer;

alter table public.coaches drop constraint if exists coaches_cancel_notice_hours_check;
alter table public.coaches
  add constraint coaches_cancel_notice_hours_check check (cancel_notice_hours is null or cancel_notice_hours between 1 and 168);
alter table public.coaches drop constraint if exists coaches_travel_miles_check;
alter table public.coaches
  add constraint coaches_travel_miles_check check (travel_miles is null or travel_miles between 1 and 500);
alter table public.coaches drop constraint if exists coaches_group_min_check;
alter table public.coaches
  add constraint coaches_group_min_check check (group_min is null or group_min between 2 and 50);

comment on column public.coaches.cancel_notice_hours is 'Hours of notice for a full refund (Schedule settings). Null = cancellation_policy text or 24.';
comment on column public.coaches.travel_miles is 'How far the coach travels for in-person sessions, from travel_zip. Null = not set.';
comment on column public.coaches.travel_zip is 'ZIP the travel distance is measured from.';
comment on column public.coaches.group_min is 'Fewest athletes a group session needs, or it moves. Null = no minimum.';

create or replace function public.get_schedule_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_today date := (now() at time zone 'America/New_York')::date;
begin
  if v_coach_id is null then
    raise exception 'Only coaches have schedule settings' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'new_family_booking', coach.new_family_booking,
      'booking_window_weeks', coach.booking_window_weeks,
      'cancel_notice_hours', coach.cancel_notice_hours,
      'cancellation_policy', coach.cancellation_policy,
      'travel_miles', coach.travel_miles,
      'travel_zip', coach.travel_zip,
      'group_min', coach.group_min,
      'home_zip', (
        select profile.zip_code from public.user_profiles as profile
        where profile.coach_id = v_coach_id
        limit 1
      ),
      'time_off', coalesce((
        select jsonb_agg(jsonb_build_object('date', off.off_date, 'note', off.note) order by off.off_date)
        from public.coach_time_off as off
        where off.coach_id = v_coach_id and off.off_date >= v_today
      ), '[]'::jsonb)
    )
    from public.coaches as coach
    where coach.id = v_coach_id
  );
end;
$$;

revoke all on function public.get_schedule_settings() from public, anon;
grant execute on function public.get_schedule_settings() to authenticated;

create or replace function public.schedule_set_booking_rules(
  p_new_family_booking text,
  p_booking_window_weeks integer,
  p_cancel_notice_hours integer,
  p_travel_miles integer,
  p_travel_zip text,
  p_group_min integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_zip text := nullif(btrim(coalesce(p_travel_zip, '')), '');
begin
  if v_coach_id is null then
    raise exception 'Only coaches have booking rules' using errcode = '42501';
  end if;
  if p_new_family_booking is not null and p_new_family_booking not in ('request', 'instant') then
    raise exception 'Choose request or instant booking' using errcode = '22023';
  end if;
  if p_booking_window_weeks is not null and (p_booking_window_weeks < 1 or p_booking_window_weeks > 12) then
    raise exception 'Booking window is 1 to 12 weeks' using errcode = '22023';
  end if;
  if p_cancel_notice_hours is not null and (p_cancel_notice_hours < 1 or p_cancel_notice_hours > 168) then
    raise exception 'Cancellation notice is 1 to 168 hours' using errcode = '22023';
  end if;
  if p_travel_miles is not null and (p_travel_miles < 1 or p_travel_miles > 500) then
    raise exception 'Travel is 1 to 500 miles' using errcode = '22023';
  end if;
  if p_travel_miles is not null and v_zip is null then
    raise exception 'Add the ZIP code you travel from' using errcode = '22023';
  end if;
  if v_zip is not null and v_zip !~ '^[0-9]{5}$' then
    raise exception 'Use a 5-digit ZIP code' using errcode = '22023';
  end if;
  if p_group_min is not null and (p_group_min < 2 or p_group_min > 50) then
    raise exception 'Group minimum is 2 to 50 athletes' using errcode = '22023';
  end if;

  -- Existing rules (and the series refill) stay in one place.
  perform public.schedule_set_rules(p_new_family_booking, p_booking_window_weeks);

  -- Null clears these: they're optional rules.
  update public.coaches
    set cancel_notice_hours = p_cancel_notice_hours,
        travel_miles = p_travel_miles,
        travel_zip = case when p_travel_miles is null then null else v_zip end,
        group_min = p_group_min
    where id = v_coach_id;
end;
$$;

revoke all on function public.schedule_set_booking_rules(text, integer, integer, integer, text, integer) from public, anon;
grant execute on function public.schedule_set_booking_rules(text, integer, integer, integer, text, integer) to authenticated;
