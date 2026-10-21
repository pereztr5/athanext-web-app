-- "View All Coaches" ZIP filter: real distance from the family's ZIP.
--
-- Coaches store a ZIP (user_profiles.zip_code). The browser looks up that ZIP's center
-- (zippopotam.us) when a coach saves their profile and stores it here with
-- set_my_coach_coordinates(). get_coach_coordinates() hands Browse every listed coach's
-- point; the page measures miles from the family's ZIP and falls back to the ZIP-prefix guess
-- for coaches without one (or whose ZIP changed since).
--
-- Backfill: coaches get coordinates the next time they save their profile. To fill them all
-- at once, run a one-off script with the service role that reads each coach's ZIP, looks it up
-- on https://api.zippopotam.us/us/<zip> and updates coaches.zip_latitude / zip_longitude /
-- coordinates_zip.
-- Safe to run more than once.

alter table public.coaches
  add column if not exists zip_latitude double precision check (zip_latitude is null or zip_latitude between -90 and 90),
  add column if not exists zip_longitude double precision check (zip_longitude is null or zip_longitude between -180 and 180),
  add column if not exists coordinates_zip text check (coordinates_zip is null or coordinates_zip ~ '^\d{5}$');

create or replace function public.set_my_coach_coordinates(p_zip text, p_latitude double precision, p_longitude double precision)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null then
    raise exception 'Only coaches can set their location' using errcode = '42501';
  end if;
  if p_zip is null or p_zip !~ '^\d{5}$' then
    raise exception 'Enter a 5-digit ZIP' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'That location doesn''t look right' using errcode = '22023';
  end if;
  update public.coaches
  set zip_latitude = p_latitude, zip_longitude = p_longitude, coordinates_zip = p_zip
  where id = v_coach;
end;
$$;

revoke all on function public.set_my_coach_coordinates(text, double precision, double precision) from public, anon;
grant execute on function public.set_my_coach_coordinates(text, double precision, double precision) to authenticated;

-- ZIP centers only (the ZIP itself is already public on Browse), for active coaches.
create or replace function public.get_coach_coordinates()
returns table(coach_id uuid, zip text, latitude double precision, longitude double precision)
language sql
stable
security definer
set search_path to 'public'
as $$
  select coach.id, coach.coordinates_zip, coach.zip_latitude, coach.zip_longitude
  from public.coaches as coach
  where coach.zip_latitude is not null
    and coach.zip_longitude is not null
    and coalesce(coach.status, 'active') = 'active';
$$;

revoke all on function public.get_coach_coordinates() from public;
grant execute on function public.get_coach_coordinates() to anon, authenticated;
