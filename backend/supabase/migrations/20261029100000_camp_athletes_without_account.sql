-- Camp sign-ups without an account show on camp days (Oct 29).
--
-- Camp days are bookings, and bookings need an athlete. A family that signed up through the
-- public link while signed out had no athlete, so the camp showed only under Registrations: not
-- on coach Home, My Sessions, the schedule roster, the session page or attendance.
--
-- Now every held or paid registration with a group gets an athlete:
--   camp_registration_ensure_athlete(registration)
--     creates a camp athlete from the sign-up (name, Jan 1 of the birth year, the coach's sport),
--     with no account (user_id null) and created_from_camp_registration_id = the registration,
--     and links it. Linking re-runs the sync trigger, which books the camp days.
--   It runs from the camp_registrations sync trigger, so every path is covered: public sign-up
--   (held), card paid, coach add, mark paid, a group set later. Backfill at the end.
--
-- When the family signs in with the sign-up email (confirmed), claim_camp_registrations() calls
--   camp_adopt_athlete(registration, user)
--     * the account already has an athlete with the same name: the camp registration, its camp
--       bookings (with their attendance and notes) and client links move to that athlete, and the
--       camp athlete is deleted when nothing else points at it;
--     * the account has no athlete yet: the camp athlete becomes the account's athlete
--       (athlete_profiles.user_id, and user_profiles.athlete_id when empty). No second athlete;
--     * the account already has a different athlete (one athlete per account): the camp athlete
--       stays with the coach, the registration still belongs to the account.
--   Never for an account whose confirmed email isn't the sign-up's parent email.
--
-- Camp athletes without an account are private: athlete_profiles RLS shows a row to its own
-- account (user_id, never null here), admins, and coaches through is_my_athlete (the coach's
-- roster). No public function lists athletes without an account. In My Athletes they show as
-- Camp, "Account not set up yet", with the parent from the sign-up.
--
-- Function bodies are the live definitions with only these changes:
--   camp_registration_sync_bookings  creates the camp athlete first when there is none.
--   claim_camp_registrations         adopts camp athletes instead of creating new ones.
--   get_coach_roster                 fromCamp / hasAccount; parent name, email and phone from the
--                                    sign-up for camp athletes without an account.

alter table public.athlete_profiles
  add column if not exists created_from_camp_registration_id uuid
    references public.camp_registrations(id) on delete set null;

create index if not exists athlete_profiles_camp_registration_idx
  on public.athlete_profiles (created_from_camp_registration_id)
  where created_from_camp_registration_id is not null;

comment on column public.athlete_profiles.created_from_camp_registration_id is
  'The camp sign-up that created this athlete. With user_id null it is a camp athlete without an account: only the coach sees it until the family signs in with the sign-up email.';

create or replace function public.camp_adopt_athlete(p_registration_id uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reg public.camp_registrations%rowtype;
  v_camp_athlete public.athlete_profiles%rowtype;
  v_email text;
  v_existing uuid;
begin
  if p_registration_id is null or p_user is null then
    return null;
  end if;
  select * into v_reg from public.camp_registrations where id = p_registration_id for update;
  if not found or v_reg.athlete_id is null or v_reg.parent_email is null then
    return null;
  end if;
  select * into v_camp_athlete
  from public.athlete_profiles
  where id = v_reg.athlete_id and user_id is null and created_from_camp_registration_id is not null
  for update;
  if not found then
    return null;
  end if;

  -- Only the account whose confirmed email is the sign-up's parent email.
  select lower(u.email) into v_email
  from auth.users as u
  where u.id = p_user and u.email_confirmed_at is not null;
  if v_email is null or v_email <> lower(btrim(v_reg.parent_email)) then
    return null;
  end if;

  select athlete.id into v_existing
  from public.athlete_profiles as athlete
  where athlete.id <> v_camp_athlete.id
    and (
      athlete.user_id = p_user
      or athlete.id = (select up.athlete_id from public.user_profiles as up where up.id = p_user)
    )
    and lower(btrim(athlete.full_name)) = lower(btrim(v_camp_athlete.full_name))
  order by athlete.created_at
  limit 1;

  if v_existing is not null then
    -- The account's athlete already has its own spot at one of these camps: left for the coach.
    if exists (
      select 1
      from public.camp_registrations as mine
      join public.camp_registrations as theirs on theirs.camp_id = mine.camp_id
      where mine.athlete_id = v_camp_athlete.id
        and mine.status in ('pending_payment', 'held', 'paid')
        and theirs.athlete_id = v_existing
        and theirs.status in ('pending_payment', 'held', 'paid')
    ) then
      return null;
    end if;

    -- Camp bookings first (past days too), so the re-sync below finds them on the right athlete.
    update public.coach_slot_bookings
      set athlete_id = v_existing, updated_at = now()
      where athlete_id = v_camp_athlete.id and camp_registration_id is not null;
    update public.slot_attendance_v2
      set athlete_id = v_existing
      where athlete_id = v_camp_athlete.id
        and booking_id in (
          select b.id from public.coach_slot_bookings as b
          where b.athlete_id = v_existing and b.camp_registration_id is not null
        );
    update public.slot_feedback_v2
      set athlete_id = v_existing
      where athlete_id = v_camp_athlete.id
        and booking_id in (
          select b.id from public.coach_slot_bookings as b
          where b.athlete_id = v_existing and b.camp_registration_id is not null
        );
    update public.camp_registrations set athlete_id = v_existing where athlete_id = v_camp_athlete.id;
    -- Client links follow; one confirmed link per coach and athlete.
    update public.coach_client_referrals as ref
      set athlete_id = case
        when ref.status = 'confirmed' and exists (
          select 1 from public.coach_client_referrals as other
          where other.coach_id = ref.coach_id and other.athlete_id = v_existing
            and other.status = 'confirmed' and other.id <> ref.id
        ) then null
        else v_existing
      end
      where ref.athlete_id = v_camp_athlete.id;

    -- Deleted only when nothing else points at it.
    if not exists (select 1 from public.coach_slot_bookings where athlete_id = v_camp_athlete.id)
       and not exists (select 1 from public.camp_registrations where athlete_id = v_camp_athlete.id)
       and not exists (select 1 from public.slot_attendance_v2 where athlete_id = v_camp_athlete.id)
       and not exists (select 1 from public.slot_feedback_v2 where athlete_id = v_camp_athlete.id)
       and not exists (select 1 from public.session_issue_reports where athlete_id = v_camp_athlete.id)
       and not exists (select 1 from public.coach_athlete_notes where athlete_id = v_camp_athlete.id)
       and not exists (select 1 from public.coach_invoices where athlete_id = v_camp_athlete.id)
       and not exists (select 1 from public.coach_intro_calls where athlete_id = v_camp_athlete.id)
       and not exists (select 1 from public.coach_client_referrals where athlete_id = v_camp_athlete.id)
       and not exists (select 1 from public.gear_purchases where athlete_id = v_camp_athlete.id)
       and not exists (select 1 from public.athlete_guardians where athlete_id = v_camp_athlete.id)
       and not exists (select 1 from public.user_profiles where athlete_id = v_camp_athlete.id) then
      delete from public.athlete_profiles where id = v_camp_athlete.id;
    end if;
    return 'merged';
  end if;

  -- One athlete per account (athlete_profiles_user_id_key): a second child stays a camp athlete.
  if exists (select 1 from public.athlete_profiles where user_id = p_user) then
    return null;
  end if;
  update public.athlete_profiles set user_id = p_user, updated_at = now() where id = v_camp_athlete.id;
  update public.user_profiles set athlete_id = v_camp_athlete.id where id = p_user and athlete_id is null;
  return 'attached';
end;
$function$;

revoke all on function public.camp_adopt_athlete(uuid, uuid) from public, anon, authenticated;
grant execute on function public.camp_adopt_athlete(uuid, uuid) to service_role;

create or replace function public.camp_registration_ensure_athlete(p_registration_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reg public.camp_registrations%rowtype;
  v_sport text;
  v_athlete uuid;
begin
  select * into v_reg from public.camp_registrations where id = p_registration_id for update;
  if not found or v_reg.athlete_id is not null or v_reg.status not in ('held', 'paid') or v_reg.group_id is null then
    return null;
  end if;

  select nullif(btrim(up.sport), '') into v_sport
  from public.user_profiles as up
  where up.coach_id = v_reg.coach_id and nullif(btrim(up.sport), '') is not null
  limit 1;

  -- Only the birth year is known; the family completes the profile after signing in.
  insert into public.athlete_profiles (
    user_id, full_name, sport, date_of_birth, profile_completed, created_from_camp_registration_id
  ) values (
    null,
    btrim(btrim(v_reg.athlete_first_name) || ' ' || btrim(coalesce(v_reg.athlete_last_name, ''))),
    coalesce(v_sport, 'Soccer'),
    make_date(coalesce(v_reg.birth_year, extract(year from timezone('America/New_York', now()))::integer - 10), 1, 1),
    false,
    v_reg.id
  )
  returning id into v_athlete;

  -- Re-runs camp_registration_sync_bookings, which books the camp days for this athlete.
  update public.camp_registrations set athlete_id = v_athlete where id = v_reg.id;

  -- Already linked to an account (claimed while the card payment was open): adopt it now.
  if v_reg.user_id is not null then
    perform public.camp_adopt_athlete(v_reg.id, v_reg.user_id);
  end if;
  return v_athlete;
end;
$function$;

revoke all on function public.camp_registration_ensure_athlete(uuid) from public, anon, authenticated;
grant execute on function public.camp_registration_ensure_athlete(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.camp_registration_sync_bookings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.group_id is not distinct from old.group_id
     and new.athlete_id is not distinct from old.athlete_id
     and new.user_id is not distinct from old.user_id then
    return null;
  end if;
  -- Held or paid without an athlete (signed out, or not linked yet): a camp athlete first.
  -- Linking it re-runs this trigger, which books the camp days.
  if new.status in ('held', 'paid') and new.athlete_id is null and new.group_id is not null then
    begin
      if public.camp_registration_ensure_athlete(new.id) is not null then
        return null;
      end if;
    exception when others then
      raise warning 'camp_registration_ensure_athlete %: %', new.id, sqlerrm;
    end;
  end if;
  begin
    perform public.sync_camp_registration_bookings(new.id);
  exception when others then
    raise warning 'camp_registration_sync_bookings %: %', new.id, sqlerrm;
  end;
  return null;
end;
$function$;

revoke all on function public.camp_registration_sync_bookings() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_camp_registrations()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_reg record;
  v_result text;
  v_claimed integer := 0;
  v_created integer := 0;
  v_merged integer := 0;
  v_client record;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select lower(u.email) into v_email
  from auth.users as u
  where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then
    return jsonb_build_object('claimed', 0, 'athletes_created', 0, 'athletes_merged', 0, 'email_confirmed', false);
  end if;

  update public.camp_registrations
    set user_id = v_uid
    where user_id is null and parent_email is not null and lower(parent_email) = v_email
      and status in ('pending_payment', 'held', 'paid');
  get diagnostics v_claimed = row_count;

  -- Held and paid sign-ups already have a camp athlete (camp_registration_ensure_athlete):
  -- it becomes this account's athlete, or merges into the account's athlete with the same name.
  for v_reg in
    select reg.id, reg.athlete_id
    from public.camp_registrations as reg
    where reg.user_id = v_uid and reg.status in ('held', 'paid')
      and lower(btrim(coalesce(reg.parent_email, ''))) = v_email
    order by reg.created_at
  loop
    if v_reg.athlete_id is null then
      perform public.camp_registration_ensure_athlete(v_reg.id);
      continue;
    end if;
    v_result := public.camp_adopt_athlete(v_reg.id, v_uid);
    if v_result = 'attached' then
      v_created := v_created + 1;
    elsif v_result = 'merged' then
      v_merged := v_merged + 1;
    end if;
  end loop;

  -- Camp families are the coach's clients: link each camp coach's referral to this account.
  -- Only an athlete with an account goes on the link (a camp athlete without one stays off it).
  for v_client in
    select distinct on (reg.coach_id) reg.coach_id, reg.parent_name, reg.athlete_first_name,
      case when athlete.user_id is not null then reg.athlete_id end as athlete_id
    from public.camp_registrations as reg
    left join public.athlete_profiles as athlete on athlete.id = reg.athlete_id
    where reg.user_id = v_uid and reg.status in ('pending_payment', 'held', 'paid')
    order by reg.coach_id, (athlete.user_id is null), reg.created_at desc
  loop
    perform public.camp_link_client(
      v_client.coach_id, v_email, v_client.parent_name, v_client.athlete_first_name, v_uid, v_client.athlete_id
    );
  end loop;

  return jsonb_build_object('claimed', v_claimed, 'athletes_created', v_created, 'athletes_merged', v_merged,
                            'email_confirmed', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_coach_roster()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null then
    raise exception 'Only coaches can see their athletes' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(r)::jsonb order by r.name)
    from (
      select
        athlete.id,
        athlete.full_name as name,
        athlete.profile_image_url as "imageUrl",
        extract(year from age(current_date, athlete.date_of_birth))::int as age,
        athlete.position,
        nullif(athlete.high_school, '') as team,
        coalesce(account.name, camp_reg.parent_name) as "accountName",
        coalesce(account.email, camp_reg.parent_email) as email,
        coalesce(account.phone_number, camp_reg.parent_phone) as phone,
        public.is_coach_client(v_coach, athlete.id) as "isClient",
        -- A camp athlete without an account of its own (made from a camp sign-up).
        camp_reg.id is not null as "fromCamp",
        account.id is not null as "hasAccount",
        coalesce(
          (select min(booking.created_at)::date from public.coach_slot_bookings as booking
            where booking.coach_id = v_coach and booking.athlete_id = athlete.id),
          athlete.created_at::date
        ) as "joinedOn",
        coalesce((
          select jsonb_agg(distinct occ.pillar_slot) filter (where occ.pillar_slot is not null)
          from public.coach_slot_bookings as booking
          join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
          where booking.coach_id = v_coach and booking.athlete_id = athlete.id
        ), '[]'::jsonb) as pillars,
        (
          select jsonb_build_object('date', occ.occurrence_date, 'startTime', occ.start_time, 'place', coalesce(occ.place, occ.location))
          from public.coach_slot_bookings as booking
          join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
          where booking.coach_id = v_coach and booking.athlete_id = athlete.id
            and booking.status in ('booked', 'pending_payment', 'requested')
            and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
          order by occ.occurrence_date, occ.start_time
          limit 1
        ) as next,
        (
          select occ.occurrence_date
          from public.coach_slot_bookings as booking
          join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
          where booking.coach_id = v_coach and booking.athlete_id = athlete.id
            and booking.status in ('booked', 'completed')
            and public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
          order by occ.occurrence_date desc, occ.start_time desc
          limit 1
        ) as "lastDate",
        coalesce((
          select sum(purchase.sessions_remaining)::int
          from public.package_purchases as purchase
          where purchase.coach_id = v_coach
            and purchase.user_id = athlete.user_id
            and purchase.expiry_date >= current_date
            and purchase.sessions_remaining > 0
            and purchase.status not in ('canceled', 'cancelled', 'refunded')
        ), 0) as credits,
        pkg.name as "packageName",
        pkg.sessions_total as "packageTotal",
        case when pkg.id is null then null else pkg.sessions_total - pkg.sessions_remaining end as "packageUsed",
        (
          select count(*)::int
          from public.coach_slot_bookings as booking
          join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
          where booking.coach_id = v_coach and booking.athlete_id = athlete.id
            and booking.status in ('booked', 'completed')
            and public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
        ) as "sessionsCount",
        coalesce((
          select sum(occ.price)
          from public.coach_slot_bookings as booking
          join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
          where booking.coach_id = v_coach and booking.athlete_id = athlete.id
            and booking.payment_status = 'paid'
            and booking.status in ('booked', 'completed')
        ), 0) + coalesce((
          select sum(purchase.total_amount)
          from public.package_purchases as purchase
          where purchase.coach_id = v_coach
            and purchase.user_id = athlete.user_id
            and purchase.status not in ('canceled', 'cancelled', 'refunded')
        ), 0) as spent,
        coalesce((
          select sum(gear.amount - gear.refunded_amount)
          from public.gear_purchases as gear
          where gear.athlete_id = athlete.id
            and (gear.coach_id is null or gear.coach_id = v_coach)
        ), 0) as "gearTotal"
      from public.athlete_profiles as athlete
      left join public.camp_registrations as camp_reg
        on camp_reg.id = athlete.created_from_camp_registration_id and athlete.user_id is null
      left join public.user_profiles as account on account.id = coalesce(athlete.user_id, camp_reg.user_id)
      left join lateral (
        select purchase.id, package.package_name as name, purchase.sessions_total, purchase.sessions_remaining
        from public.package_purchases as purchase
        join public.coach_packages as package on package.id = purchase.package_id
        where purchase.coach_id = v_coach
          and purchase.user_id = athlete.user_id
          and purchase.status not in ('canceled', 'cancelled', 'refunded')
        order by (purchase.expiry_date >= current_date and purchase.sessions_remaining > 0) desc,
          purchase.purchase_date desc
        limit 1
      ) as pkg on true
      where athlete.id in (select public.coach_roster_ids(v_coach))
    ) as r
  ), '[]'::jsonb);
end;
$function$;

-- Backfill: held and paid sign-ups without an athlete get their camp athlete and camp days.
do $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.camp_registrations
    where status in ('held', 'paid') and athlete_id is null and group_id is not null
    order by created_at
  loop
    perform public.camp_registration_ensure_athlete(v_id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
