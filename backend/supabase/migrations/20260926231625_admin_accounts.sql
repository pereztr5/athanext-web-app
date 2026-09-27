-- Admins can change or remove an account without taking past sessions with it.
-- A coach profile is hidden by status, not deleted, because bookings reference it.

alter table public.coach_slot_bookings
  alter column athlete_id drop not null;

alter table public.coach_slot_bookings
  drop constraint if exists coach_slot_bookings_athlete_id_fkey1;

alter table public.coach_slot_bookings
  add constraint coach_slot_bookings_athlete_id_fkey1
  foreign key (athlete_id) references public.athlete_profiles(id) on delete set null;

alter table public.athlete_profiles
  alter column user_id drop not null;

alter table public.athlete_profiles
  drop constraint if exists athlete_profiles_user_id_fkey;

alter table public.athlete_profiles
  add constraint athlete_profiles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.coach_slot_bookings
  drop constraint if exists coach_slot_bookings_created_by_fkey;

alter table public.coach_slot_bookings
  add constraint coach_slot_bookings_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.slot_feedback_v2
  drop constraint if exists slot_feedback_v2_created_by_fkey;

alter table public.slot_feedback_v2
  add constraint slot_feedback_v2_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.slot_attendance_v2
  drop constraint if exists slot_attendance_v2_created_by_fkey;

alter table public.slot_attendance_v2
  add constraint slot_attendance_v2_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.session_feedback_v2
  drop constraint if exists session_feedback_v2_created_by_fkey;

alter table public.session_feedback_v2
  add constraint session_feedback_v2_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.package_purchases
  alter column user_id drop not null;

alter table public.package_purchases
  drop constraint if exists package_purchases_user_id_fkey;

alter table public.package_purchases
  add constraint package_purchases_user_id_fkey
  foreign key (user_id) references public.user_profiles(id) on delete set null;

create or replace function public.get_coaches_public()
returns table(
  id uuid,
  name text,
  bio text,
  profile_image_url text,
  image_url text,
  company text,
  coach_position text,
  positions text[],
  locations text[],
  specialties text[],
  languages text[],
  hourly_rate integer,
  rating numeric,
  total_reviews integer,
  years_experience integer,
  response_time_hours integer,
  session_types text[],
  availability jsonb,
  cancellation_policy text,
  instagram_handle text,
  status text,
  is_verified boolean,
  cover_image_urls text[],
  created_at timestamptz,
  updated_at timestamptz,
  sport_type text,
  favourite_positions text[]
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    c.id,
    c.name,
    c.bio,
    c.profile_image_url,
    c.image_url,
    c.company,
    c."position" as coach_position,
    c.positions,
    c.locations,
    c.specialties,
    c.languages,
    c.hourly_rate,
    c.rating,
    c.total_reviews,
    c.years_experience,
    c.response_time_hours,
    c.session_types,
    c.availability,
    c.cancellation_policy,
    c.instagram_handle,
    c.status,
    c.is_verified,
    c.cover_image_urls,
    c.created_at,
    c.updated_at,
    up.sport as sport_type,
    c.favourite_positions
  from public.coaches c
  left join public.user_profiles up on c.id = up.coach_id
  where c.is_verified = true
    and c.status is distinct from 'hidden';
$function$;

create or replace function public.assert_admin()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only an admin can manage accounts' using errcode = '42501';
  end if;
end;
$function$;

create or replace function public.admin_search_users(p_query text)
returns table(
  id uuid,
  name text,
  email text,
  persona_type text,
  is_active boolean,
  coach_id uuid,
  athlete_id uuid
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_query text := btrim(coalesce(p_query, ''));
begin
  perform public.assert_admin();
  if char_length(v_query) < 2 then
    return;
  end if;

  return query
  select
    profile.id,
    profile.name,
    profile.email,
    profile.persona_type,
    profile.is_active,
    profile.coach_id,
    profile.athlete_id
  from public.user_profiles as profile
  where profile.name ilike '%' || v_query || '%'
     or profile.email ilike '%' || v_query || '%'
  order by profile.name
  limit 20;
end;
$function$;

create or replace function public.admin_update_account(
  p_user_id uuid,
  p_name text,
  p_email text,
  p_persona text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_persona text := lower(btrim(coalesce(p_persona, '')));
  v_profile public.user_profiles%rowtype;
  v_coach_id uuid;
  v_athlete_id uuid;
  v_dob date;
  v_sport text;
begin
  perform public.assert_admin();

  if v_name = '' or char_length(v_name) > 100 then
    raise exception 'Name is required and must be 100 characters or fewer';
  end if;
  if char_length(v_email) > 255
     or v_email !~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$' then
    raise exception 'Email is not valid';
  end if;
  if v_persona not in ('athlete', 'parent', 'coach') then
    raise exception 'Persona must be athlete, parent, or coach';
  end if;

  select * into v_profile
  from public.user_profiles
  where id = p_user_id;
  if not found then
    raise exception 'Account not found';
  end if;

  if exists (
    select 1 from public.user_profiles
    where lower(email) = v_email and id <> p_user_id
  ) or exists (
    select 1 from auth.users
    where lower(email) = v_email and id <> p_user_id
  ) then
    raise exception 'That email is already in use';
  end if;

  update public.user_profiles
  set
    name = v_name,
    email = v_email,
    persona_type = v_persona,
    updated_at = now()
  where id = p_user_id
  returning coach_id, athlete_id, date_of_birth, sport
  into v_coach_id, v_athlete_id, v_dob, v_sport;

  if v_athlete_id is not null then
    update public.athlete_profiles
    set full_name = v_name, updated_at = now()
    where id = v_athlete_id;
  end if;

  if v_persona = 'coach' then
    if v_coach_id is null then
      insert into public.coaches (name, email, status, hourly_rate, locations, specialties)
      values (v_name, v_email, 'active', 0, '{}', '{}')
      returning id into v_coach_id;
      update public.user_profiles
      set coach_id = v_coach_id, updated_at = now()
      where id = p_user_id;
    else
      update public.coaches
      set name = v_name, email = v_email, status = 'active', updated_at = now()
      where id = v_coach_id;
    end if;
  else
    if v_coach_id is not null then
      update public.coaches
      set name = v_name, email = v_email, status = 'hidden', updated_at = now()
      where id = v_coach_id;
    end if;
    if v_athlete_id is null then
      if v_dob is null then
        raise exception 'Add a date of birth on this account before changing it to an athlete or parent';
      end if;
      insert into public.athlete_profiles (
        user_id, full_name, sport, date_of_birth, tags, cover_image_urls, profile_completed
      )
      values (
        p_user_id, v_name, coalesce(nullif(v_sport, ''), 'soccer'), v_dob, '{}', '{}', false
      )
      returning id into v_athlete_id;
      update public.user_profiles
      set athlete_id = v_athlete_id, updated_at = now()
      where id = p_user_id;
    end if;
  end if;
end;
$function$;

create or replace function public.admin_set_account_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_coach_id uuid;
  v_persona text;
begin
  perform public.assert_admin();
  if p_user_id = auth.uid() and not p_active then
    raise exception 'You cannot deactivate your own account';
  end if;
  if not p_active
     and exists (
       select 1 from public.user_roles
       where user_id = p_user_id and role = 'admin'::public.app_role
     )
     and (
       select count(*) from public.user_roles where role = 'admin'::public.app_role
     ) <= 1 then
    raise exception 'The last admin account cannot be deactivated';
  end if;

  select coach_id, persona_type into v_coach_id, v_persona
  from public.user_profiles
  where id = p_user_id;
  if not found then
    raise exception 'Account not found';
  end if;

  update public.user_profiles
  set is_active = p_active, updated_at = now()
  where id = p_user_id;

  if v_coach_id is not null then
    update public.coaches
    set status = case
      when p_active and v_persona = 'coach' then 'active'
      else 'hidden'
    end,
    updated_at = now()
    where id = v_coach_id;
  end if;
end;
$function$;

create or replace function public.admin_prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_athlete_id uuid;
  v_coach_id uuid;
  v_today date := (timezone('America/New_York', now()))::date;
begin
  perform public.assert_admin();
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;
  if exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = 'admin'::public.app_role
  ) and (
    select count(*) from public.user_roles where role = 'admin'::public.app_role
  ) <= 1 then
    raise exception 'The last admin account cannot be deleted';
  end if;

  select athlete_id, coach_id into v_athlete_id, v_coach_id
  from public.user_profiles
  where id = p_user_id;

  if v_athlete_id is not null or v_coach_id is not null then
    update public.coach_slot_bookings as booking
    set
      status = 'canceled',
      canceled_at = now(),
      cancellation_reason = 'Account deleted',
      updated_at = now()
    from public.coach_availability_slot_occurrences as occurrence
    where booking.occurrence_id = occurrence.id
      and booking.status in ('booked', 'pending_payment')
      and occurrence.occurrence_date >= v_today
      and (
        (v_athlete_id is not null and booking.athlete_id = v_athlete_id)
        or (v_coach_id is not null and booking.coach_id = v_coach_id)
      );

    if v_athlete_id is not null then
      update public.coach_slot_bookings as booking
      set athlete_id = null, updated_at = now()
      from public.coach_availability_slot_occurrences as occurrence
      where booking.occurrence_id = occurrence.id
        and booking.athlete_id = v_athlete_id
        and occurrence.occurrence_date < v_today;
    end if;
  end if;

  if v_coach_id is not null then
    update public.coaches
    set status = 'hidden', updated_at = now()
    where id = v_coach_id;
  end if;

  if v_athlete_id is not null then
    update public.athlete_profiles
    set user_id = null, updated_at = now()
    where id = v_athlete_id;
  end if;

  update public.coach_slot_bookings set created_by = null where created_by = p_user_id;
  update public.slot_feedback_v2 set created_by = null where created_by = p_user_id;
  update public.slot_attendance_v2 set created_by = null where created_by = p_user_id;
  update public.session_feedback_v2 set created_by = null where created_by = p_user_id;
end;
$function$;

revoke all on function public.assert_admin() from public, anon, authenticated;
revoke all on function public.admin_search_users(text) from public, anon;
revoke all on function public.admin_update_account(uuid, text, text, text) from public, anon;
revoke all on function public.admin_set_account_active(uuid, boolean) from public, anon;
revoke all on function public.admin_prepare_account_deletion(uuid) from public, anon;
grant execute on function public.admin_search_users(text) to authenticated;
grant execute on function public.admin_update_account(uuid, text, text, text) to authenticated;
grant execute on function public.admin_set_account_active(uuid, boolean) to authenticated;
grant execute on function public.admin_prepare_account_deletion(uuid) to authenticated;
grant execute on function public.get_coaches_public() to anon, authenticated;

drop policy if exists "Enable read access for all users" on public.coaches;

create policy "Enable read access for all users"
on public.coaches
for select
to public
using (
  status is distinct from 'hidden'
  or exists (
    select 1
    from public.user_profiles as profile
    where profile.coach_id = coaches.id
      and profile.id = (select auth.uid())
  )
);
