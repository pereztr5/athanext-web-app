-- Admin Edit user (ATH-104): auth.identities.email is a generated column (from identity_data),
-- so writing it failed every call with 'column "email" can only be updated to DEFAULT'.
-- Update identity_data only; the generated email follows it. Otherwise unchanged.

CREATE OR REPLACE FUNCTION public.admin_update_account(p_user_id uuid, p_name text, p_email text, p_persona text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_persona text := lower(btrim(coalesce(p_persona, '')));
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

  if not exists (select 1 from public.user_profiles where id = p_user_id) then
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

  update auth.users
  set email = v_email, updated_at = now()
  where id = p_user_id;

  update auth.identities
  set
    identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_email)
  where user_id = p_user_id and provider = 'email';

  update public.user_profiles
  set name = v_name, email = v_email, persona_type = v_persona, updated_at = now()
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

notify pgrst, 'reload schema';
