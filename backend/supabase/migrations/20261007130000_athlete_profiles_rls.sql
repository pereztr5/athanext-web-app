-- Athlete profiles were readable and editable by every signed-in user, minors included.
-- Now:
--   read:   the account holder (athlete or parent), coaches who have the athlete on their
--           roster (accepted, booked or past sessions, or a confirmed client), and admins
--   update: the account holder and admins
--   insert / delete: the account holder (unchanged)
-- Coaches who only have a request see the request preview through get_coach_booking_requests.
-- api.athlete_profiles is a security_invoker view, so it follows these rules too.

drop policy if exists "Enable read access for all authenticated users" on public.athlete_profiles;
drop policy if exists "Enable update access for all authenticated users" on public.athlete_profiles;

-- True when the athlete is on the signed-in coach's roster. Only answers for the caller's own
-- roster; coach_roster_ids itself stays private.
create or replace function public.is_my_athlete(p_athlete_id uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select public.current_coach_id() is not null
    and p_athlete_id in (select public.coach_roster_ids(public.current_coach_id()));
$$;

revoke all on function public.is_my_athlete(uuid) from public, anon;
grant execute on function public.is_my_athlete(uuid) to authenticated;

drop policy if exists "Coaches read their athletes" on public.athlete_profiles;
create policy "Coaches read their athletes" on public.athlete_profiles
  for select to authenticated
  using (public.is_my_athlete(id));

drop policy if exists "Admins read athletes" on public.athlete_profiles;
create policy "Admins read athletes" on public.athlete_profiles
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins update athletes" on public.athlete_profiles;
create policy "Admins update athletes" on public.athlete_profiles
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
