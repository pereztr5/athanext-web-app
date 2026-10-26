-- Admins configure coach and athlete profiles on behalf of users.
-- 1. Storage: is_admin() may upload/replace/delete under coach-profiles/ and athlete-profiles/.
-- 2. admin_set_coach_coordinates(p_coach_id, …) mirrors set_my_coach_coordinates for any coach.
-- 3. admin_set_coach_profile_services(p_coach_id, …) mirrors set_coach_profile_services.
-- 4. coach_certifications: admins can insert/update/delete any coach's rows.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
drop policy if exists "Admins manage coach profile photos" on storage.objects;
create policy "Admins manage coach profile photos"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'coach-profiles'
    and public.is_admin()
  )
  with check (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'coach-profiles'
    and public.is_admin()
  );

drop policy if exists "Admins manage athlete profile photos" on storage.objects;
create policy "Admins manage athlete profile photos"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'athlete-profiles'
    and public.is_admin()
  )
  with check (
    bucket_id = 'athalink-images'
    and (storage.foldername(name))[1] = 'athlete-profiles'
    and public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Coordinates
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_coach_coordinates(
  p_coach_id uuid,
  p_zip text,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can set another coach location' using errcode = '42501';
  end if;
  if p_coach_id is null then
    raise exception 'Coach is required' using errcode = '22023';
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
  where id = p_coach_id;
  if not found then
    raise exception 'Coach not found' using errcode = 'P0002';
  end if;
  update public.user_profiles set zip_code = p_zip where coach_id = p_coach_id;
end;
$$;

revoke all on function public.admin_set_coach_coordinates(uuid, text, double precision, double precision) from public, anon;
grant execute on function public.admin_set_coach_coordinates(uuid, text, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile services (session types)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_coach_profile_services(p_coach_id uuid, p_services jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can edit another coach session types' using errcode = '42501';
  end if;
  if p_coach_id is null then
    raise exception 'Coach is required' using errcode = '22023';
  end if;
  if p_services is null or jsonb_typeof(p_services) <> 'array' then
    raise exception 'Session types must be a list';
  end if;
  if jsonb_array_length(p_services) > 20 then
    raise exception 'Up to 20 session types';
  end if;
  for v_item in select * from jsonb_array_elements(p_services) loop
    if coalesce(btrim(v_item->>'id'), '') = '' or coalesce(btrim(v_item->>'name'), '') = '' then
      raise exception 'Each session type needs a name';
    end if;
    if coalesce(v_item->>'format', '') not in ('individual', 'group') then
      raise exception 'Session format must be individual or group';
    end if;
    if coalesce((v_item->>'minutes')::integer, 0) not between 15 and 480 then
      raise exception 'Session length must be 15 to 480 minutes';
    end if;
    if v_item->>'id' <> 'individual' and coalesce((v_item->>'price')::numeric, -1) not between 0 and 10000 then
      raise exception 'Price must be 0 to 10000';
    end if;
  end loop;
  update public.coaches
    set profile_services = p_services, updated_at = now()
  where id = p_coach_id;
  if not found then
    raise exception 'Coach not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_coach_profile_services(uuid, jsonb) from public, anon;
grant execute on function public.admin_set_coach_profile_services(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Certifications: admin can manage any coach's rows
-- ---------------------------------------------------------------------------
alter table public.coach_certifications enable row level security;

drop policy if exists "Admins manage coach certifications" on public.coach_certifications;
create policy "Admins manage coach certifications"
  on public.coach_certifications
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Coaches manage own certifications" on public.coach_certifications;
create policy "Coaches manage own certifications"
  on public.coach_certifications
  for all
  to authenticated
  using (coach_id = public.current_coach_id())
  with check (coach_id = public.current_coach_id());

drop policy if exists "Public can read coach certifications" on public.coach_certifications;
create policy "Public can read coach certifications"
  on public.coach_certifications
  for select
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';
