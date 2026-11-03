-- All users: include a resolved avatar URL so the admin list can show profile photos.
drop function if exists public.admin_list_users();

create function public.admin_list_users()
returns table (
  id uuid,
  name text,
  email text,
  persona text,
  sport text,
  "position" text,
  joined_at timestamptz,
  is_test boolean,
  coach_id uuid,
  coach_verified boolean,
  athlete_id uuid,
  athlete_name text,
  athlete_minor boolean,
  has_guardian boolean,
  signup_method text,
  origin_coach_id uuid,
  origin_coach_name text,
  origin_camp_id uuid,
  origin_camp_name text,
  invite_pending boolean,
  status text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    coalesce(nullif(btrim(u.name), ''), u.email) as name,
    u.email,
    case u.persona_type when 'coach' then 'coach' when 'parent' then 'family' when 'athlete' then 'athlete' else coalesce(u.persona_type::text, 'unknown') end as persona,
    lower(coalesce(nullif(u.sport, ''), a.sport)) as sport,
    coalesce(nullif(u.position, ''), a.position, c.position) as "position",
    u.created_at as joined_at,
    coalesce(u.is_test_account, false) as is_test,
    u.coach_id,
    c.is_verified as coach_verified,
    u.athlete_id,
    a.full_name as athlete_name,
    coalesce(a.date_of_birth, u.date_of_birth) > (current_date - interval '18 years') as athlete_minor,
    exists (select 1 from public.athlete_guardians g where g.athlete_id = u.athlete_id) as has_guardian,
    case when camp.reg_id is not null then 'camp' when ref.coach_id is not null then 'referral' else 'direct' end as signup_method,
    coalesce(case when camp.reg_id is not null then camp.coach_id end, ref.coach_id) as origin_coach_id,
    coalesce(case when camp.reg_id is not null then camp.coach_name end, ref.coach_name) as origin_coach_name,
    camp.camp_id as origin_camp_id,
    camp.camp_name as origin_camp_name,
    pending.found as invite_pending,
    case
      when u.deletion_requested_at is not null then 'deletion_requested'
      when not coalesce(u.is_active, true) then 'inactive'
      when u.persona_type = 'coach' and not coalesce(c.is_verified, false) then 'coach_unverified'
      when not coalesce(u.is_profile_completed, false)
        or (u.persona_type = 'coach' and u.coach_id is null)
        or (u.persona_type in ('athlete', 'parent') and u.athlete_id is null) then 'profile_incomplete'
      when pending.found then 'invite_pending'
      else 'active'
    end as status,
    nullif(
      coalesce(
        nullif(u.image_url, ''),
        nullif(c.profile_image_url, ''),
        nullif(c.image_url, ''),
        nullif(a.profile_image_url, '')
      ),
      ''
    ) as avatar_url
  from public.user_profiles u
  left join public.coaches c on c.id = u.coach_id
  left join public.athlete_profiles a on a.id = u.athlete_id
  left join lateral (
    select r.id as reg_id, r.camp_id, p.package_name as camp_name, r.coach_id, cc.name as coach_name
    from public.camp_registrations r
    join public.coach_packages p on p.id = r.camp_id
    left join public.coaches cc on cc.id = r.coach_id
    where (r.user_id = u.id or r.id = a.created_from_camp_registration_id)
      and r.created_at <= u.created_at + interval '1 day'
    order by r.created_at
    limit 1
  ) camp on true
  left join lateral (
    select ref.coach_id, rc.name as coach_name
    from public.coach_client_referrals ref
    left join public.coaches rc on rc.id = ref.coach_id
    where (ref.athlete_id = u.athlete_id or lower(ref.client_email) = lower(u.email))
      and ref.created_at <= u.created_at + interval '1 day'
    order by ref.created_at
    limit 1
  ) ref on true
  left join lateral (
    select exists (
      select 1 from public.coach_client_referrals p
      where p.status in ('invited', 'pending_confirmation')
        and p.initiated_by <> 'athlete'
        and (p.athlete_id = u.athlete_id or lower(p.client_email) = lower(u.email))
    ) as found
  ) pending on true
  where public.is_admin()
  order by u.created_at desc;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
