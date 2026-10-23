-- Camp changes (Oct 24):
--
-- 1. No platform fee on camps. Every camp sign-up (link, marketplace, coach-added) pays the camp
--    price, plus card processing when paying by card (fees.ts, kind "camp"). camp_quote and
--    camp_signup_start now always report platform_waived = true.
-- 2. Paying the coach directly is offered to every family whenever the camp's switch is on (it
--    was link families and existing clients only). The rate limits, the per-email direct limit and
--    the 7-day hold are unchanged. New camps have the switch on by default.
-- 3. Camp families become the coach's existing clients: every camp sign-up (card, held, coach
--    added, and the older profile checkout) creates or confirms the coach_client_referrals row for
--    the parent email (invited_via 'camp' when new). The athlete is linked only once the family is
--    known: an athlete the coach added, a profile purchase, or claim_camp_registrations() after the
--    family signs in with that email. A confirmed row with an athlete is what gives later bookings
--    the existing-client platform-fee waiver (create-booking-payment, create-package-payment).
--
-- Function bodies are the live definitions with only these changes, plus one fix in
-- claim_camp_registrations: an account can hold one athlete profile, so a camp athlete whose name
-- doesn't match it used to fail the whole claim (unique violation); that athlete is now skipped.

alter table public.coach_packages alter column camp_pay_direct set default true;

alter table public.coach_client_referrals drop constraint if exists ccr_invited_via;
alter table public.coach_client_referrals add constraint ccr_invited_via
  check (invited_via = any (array['email'::text, 'import'::text, 'link'::text, 'admin'::text, 'camp'::text]));

-- Creates or confirms the coach-client relationship for a camp family. Idempotent; never creates
-- a second row (one row per coach and email) and never a second confirmed row for one athlete.
-- Errors are logged, never raised, so a sign-up is not lost over it.
-- p_user / p_athlete only when the family is known (an account that proved this email, or an
-- athlete the coach already works with). Returns the referral id, or null without an email.
create or replace function public.camp_link_client(
  p_coach_id uuid,
  p_email text,
  p_name text,
  p_athlete_first text,
  p_user uuid,
  p_athlete uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name text := left(nullif(btrim(coalesce(p_name, '')), ''), 120);
  v_first text := left(nullif(btrim(coalesce(p_athlete_first, '')), ''), 100);
  v_athlete uuid := p_athlete;
  v_row public.coach_client_referrals%rowtype;
  v_other uuid;
begin
  -- Never blocks a sign-up: on any error the spot is kept and the link is left for a later claim.
  begin
  if p_coach_id is null then
    return null;
  end if;
  if v_email is null and p_user is not null then
    select lower(u.email) into v_email from auth.users as u where u.id = p_user;
  end if;
  if v_email is null or char_length(v_email) > 254 then
    return null;
  end if;
  if v_athlete is null and p_user is not null then
    select coalesce(
      (select up.athlete_id from public.user_profiles as up where up.id = p_user),
      (select athlete.id from public.athlete_profiles as athlete where athlete.user_id = p_user order by athlete.created_at limit 1)
    ) into v_athlete;
  end if;

  select * into v_row
  from public.coach_client_referrals
  where coach_id = p_coach_id and lower(client_email) = v_email
  order by (status = 'confirmed') desc, created_at
  limit 1
  for update;

  if not found then
    -- Already this coach's client through another email: that row stays the only confirmed one.
    if v_athlete is not null and exists (
      select 1 from public.coach_client_referrals
      where coach_id = p_coach_id and athlete_id = v_athlete and status = 'confirmed'
    ) then
      v_athlete := null;
    end if;
    insert into public.coach_client_referrals (
      coach_id, client_email, client_name, athlete_first_name, athlete_id,
      initiated_by, invited_via, status, confirmed_at, expires_at
    ) values (
      p_coach_id, v_email, v_name, v_first, v_athlete,
      'coach', 'camp', 'confirmed', now(), null
    )
    on conflict (coach_id, client_email) do nothing
    returning * into v_row;
    if v_row.id is null then
      -- Created at the same moment by another sign-up: confirm that one.
      return public.camp_link_client(p_coach_id, v_email, p_name, p_athlete_first, p_user, p_athlete);
    end if;
    return v_row.id;
  end if;

  -- The row's own athlete wins; a new one only fills an empty slot.
  v_athlete := coalesce(v_row.athlete_id, v_athlete);
  if v_athlete is not null then
    select id into v_other
    from public.coach_client_referrals
    where coach_id = p_coach_id and athlete_id = v_athlete and status = 'confirmed' and id <> v_row.id
    limit 1;
    if v_other is not null then
      if v_row.athlete_id is not null and v_row.status <> 'confirmed' then
        return v_other; -- that athlete is already a confirmed client through another row
      end if;
      v_athlete := v_row.athlete_id; -- leave the athlete off this row
    end if;
  end if;

  if v_row.status is distinct from 'confirmed' or v_row.athlete_id is distinct from v_athlete then
    update public.coach_client_referrals
      set status = 'confirmed',
          confirmed_at = coalesce(confirmed_at, now()),
          athlete_id = v_athlete,
          -- An open invite keeps its link (claim_coach_referral still works) and no longer expires.
          expires_at = case when v_athlete is null then null else expires_at end,
          client_name = coalesce(client_name, v_name),
          athlete_first_name = coalesce(athlete_first_name, v_first)
      where id = v_row.id;
  end if;
  return v_row.id;
  exception when others then
    raise warning 'camp_link_client(%, %) failed: %', p_coach_id, v_email, sqlerrm;
    return null;
  end;
end;
$function$;

revoke all on function public.camp_link_client(uuid, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.camp_link_client(uuid, text, text, text, uuid, uuid) to service_role;

CREATE OR REPLACE FUNCTION public.camp_quote(p_camp_id uuid, p_source text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'camp_id', pkg.id,
    'price_cents', pkg.total_price,
    -- No platform fee on camps for anyone; paying the coach directly whenever the camp allows it.
    'platform_waived', true,
    'direct_allowed', pkg.camp_pay_direct
  )
  from public.coach_packages as pkg
  where pkg.id = p_camp_id and pkg.kind = 'camp' and pkg.is_active and pkg.camp_published_at is not null;
$function$;

CREATE OR REPLACE FUNCTION public.camp_signup_start(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_camp public.coach_packages%rowtype;
  v_coach public.coaches%rowtype;
  v_source text := p->>'source';
  v_pay text := p->>'pay_method';
  v_parent_name text := btrim(coalesce(p->'parent'->>'name', ''));
  v_email text := lower(btrim(coalesce(p->'parent'->>'email', '')));
  v_phone text := nullif(btrim(coalesce(p->'parent'->>'phone', '')), '');
  v_note text := nullif(btrim(coalesce(p->>'note', '')), '');
  v_ip text := nullif(btrim(coalesce(p->>'ip_hash', '')), '');
  v_hold_minutes integer := 40;
  v_per_ip integer := 5;
  v_per_email integer := 5;
  v_direct_per_email integer := 3;
  v_year integer := extract(year from now())::integer;
  v_athletes jsonb := p->'athletes';
  v_athlete jsonb;
  v_first text;
  v_last text;
  v_year_txt text;
  v_group uuid;
  v_groups uuid[] := '{}';
  v_names text[] := '{}';
  v_key text;
  v_is_client boolean;
  v_waived boolean;
  v_superseded text[];
  v_signup uuid;
  v_status text;
  v_hold timestamptz;
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  if v_source is null or v_source not in ('link', 'marketplace') then
    raise exception 'Unknown sign-up source' using errcode = '22023', hint = 'invalid';
  end if;
  if v_pay is null or v_pay not in ('card', 'direct') then
    raise exception 'Choose how to pay' using errcode = '22023', hint = 'invalid';
  end if;
  if coalesce(p->>'hold_minutes', '') ~ '^\d{1,3}$' then
    v_hold_minutes := least(60, greatest(31, (p->>'hold_minutes')::integer));
  end if;
  if coalesce(p->'limits'->>'per_ip_hour', '') ~ '^\d{1,3}$' then
    v_per_ip := (p->'limits'->>'per_ip_hour')::integer;
  end if;
  if coalesce(p->'limits'->>'per_email_hour', '') ~ '^\d{1,3}$' then
    v_per_email := (p->'limits'->>'per_email_hour')::integer;
  end if;
  if coalesce(p->'limits'->>'direct_per_email', '') ~ '^\d{1,3}$' then
    v_direct_per_email := (p->'limits'->>'direct_per_email')::integer;
  end if;

  if char_length(v_parent_name) not between 1 and 120 then
    raise exception 'Add your name' using errcode = '22023', hint = 'invalid';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Add an email we can send the receipt to' using errcode = '22023', hint = 'invalid';
  end if;
  if v_phone is not null and v_phone !~ '^[0-9+()\-. ]{7,30}$' then
    raise exception 'Add a phone number, like 555 123 4567' using errcode = '22023', hint = 'invalid';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters' using errcode = '22023', hint = 'invalid';
  end if;
  if coalesce((p->>'waiver')::boolean, false) is not true then
    raise exception 'Agree to the waiver to continue' using errcode = '22023', hint = 'invalid';
  end if;
  if (case when jsonb_typeof(v_athletes) = 'array' then jsonb_array_length(v_athletes) else 0 end) not between 1 and 6 then
    raise exception 'Add between 1 and 6 athletes' using errcode = '22023', hint = 'invalid';
  end if;

  for v_athlete in select value from jsonb_array_elements(v_athletes) loop
    v_first := btrim(coalesce(v_athlete->>'first_name', ''));
    v_last := btrim(coalesce(v_athlete->>'last_name', ''));
    v_year_txt := btrim(coalesce(v_athlete->>'birth_year', ''));
    if char_length(v_first) not between 1 and 60 then
      raise exception 'Add a first name' using errcode = '22023', hint = 'invalid';
    end if;
    if char_length(v_last) not between 1 and 60 then
      raise exception 'Add a last name' using errcode = '22023', hint = 'invalid';
    end if;
    if v_year_txt !~ '^\d{4}$' or v_year_txt::integer not between v_year - 80 and v_year - 2 then
      raise exception 'Add a birth year, like 2013' using errcode = '22023', hint = 'invalid';
    end if;
    if coalesce(v_athlete->>'note', '') <> '' and char_length(v_athlete->>'note') > 500 then
      raise exception 'Keep the note under 500 characters' using errcode = '22023', hint = 'invalid';
    end if;
    v_group := case
      when coalesce(v_athlete->>'group_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (v_athlete->>'group_id')::uuid
    end;
    if v_group is null then
      raise exception 'Pick a group for each athlete' using errcode = '22023', hint = 'invalid';
    end if;
    v_key := lower(v_first) || ' ' || lower(v_last);
    if v_key = any (v_names) then
      raise exception '% is on the form twice', v_first using errcode = '22023', hint = 'invalid';
    end if;
    v_names := v_names || v_key;
    v_groups := v_groups || v_group;
  end loop;

  -- Lock the camp: sign-ups for one camp run one at a time from here.
  if coalesce(p->>'camp_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_camp from public.coach_packages
    where id = (p->>'camp_id')::uuid and kind = 'camp'
    for update;
  end if;
  if v_camp.id is null then
    raise exception 'This camp is not taking sign-ups' using errcode = 'P0002', hint = 'closed';
  end if;
  select * into v_coach from public.coaches where id = v_camp.coach_id;
  if not v_camp.is_active or v_camp.camp_published_at is null or v_coach.deactivated_at is not null
     or v_camp.camp_ends_on is null or v_camp.camp_ends_on < public.camp_today() then
    raise exception 'This camp is not taking sign-ups' using errcode = 'P0002', hint = 'closed';
  end if;

  -- Tidy this camp's lapsed holds so they don't block the unique index below.
  update public.camp_registrations
    set status = 'expired'
    where camp_id = v_camp.id and status in ('pending_payment', 'held')
      and hold_expires_at is not null and hold_expires_at <= now();

  -- Rate limits.
  if v_ip is not null and (
    select count(*) from public.camp_signups
    where ip_hash = v_ip and created_at > now() - interval '1 hour' and source in ('link', 'marketplace')
  ) >= v_per_ip then
    raise exception 'Too many sign-ups from this device. Try again in an hour.' using errcode = 'P0001', hint = 'rate_ip';
  end if;
  if (
    select count(*) from public.camp_signups
    where lower(parent_email) = v_email and created_at > now() - interval '1 hour' and source in ('link', 'marketplace')
  ) >= v_per_email then
    raise exception 'Too many sign-ups for this email. Try again in an hour.' using errcode = 'P0001', hint = 'rate_email';
  end if;

  v_is_client := public.camp_email_is_client(v_camp.coach_id, v_email);
  -- Camps carry no platform fee, whoever signs up.
  v_waived := true;

  if v_pay = 'direct' then
    -- Offered to every family when the camp allows it (limits above and below still apply).
    if not v_camp.camp_pay_direct then
      raise exception 'Pay by card to hold this spot' using errcode = '22023', hint = 'direct_not_allowed';
    end if;
    if (
      select count(distinct reg.signup_id) from public.camp_registrations as reg
      where reg.camp_id = v_camp.id and lower(reg.parent_email) = v_email
        and reg.status = 'held' and reg.pay_method = 'direct'
    ) >= v_direct_per_email then
      raise exception 'This email already has spots waiting for payment. Pay the coach for those first.'
        using errcode = 'P0001', hint = 'rate_direct';
    end if;
  end if;

  -- A new attempt replaces this family's unpaid Checkout for the same camp.
  with superseded as (
    update public.camp_registrations
      set status = 'expired'
      where camp_id = v_camp.id and lower(parent_email) = v_email and status = 'pending_payment'
      returning stripe_session_id
  )
  select coalesce(array_agg(distinct stripe_session_id) filter (where stripe_session_id is not null), '{}')
    into v_superseded from superseded;

  perform public.camp_reserve(v_camp.id, v_groups);

  if v_pay = 'card' then
    v_status := 'pending_payment';
    v_hold := now() + make_interval(mins => v_hold_minutes);
  else
    v_status := 'held';
    v_hold := now() + interval '7 days';
  end if;

  insert into public.camp_signups (camp_id, coach_id, source, pay_method, parent_email, ip_hash, platform_waived)
  values (v_camp.id, v_camp.coach_id, v_source, v_pay, v_email, v_ip, v_waived)
  returning id into v_signup;

  begin
    for v_athlete in select value from jsonb_array_elements(v_athletes) loop
      insert into public.camp_registrations (
        camp_id, group_id, signup_id, coach_id, parent_name, parent_email, parent_phone,
        athlete_first_name, athlete_last_name, birth_year, note, waiver_accepted_at, photo_consent,
        source, pay_method, status, hold_expires_at, price_cents
      ) values (
        v_camp.id, (v_athlete->>'group_id')::uuid, v_signup, v_camp.coach_id, v_parent_name, v_email, v_phone,
        btrim(v_athlete->>'first_name'), btrim(v_athlete->>'last_name'), (v_athlete->>'birth_year')::integer,
        coalesce(nullif(btrim(coalesce(v_athlete->>'note', '')), ''), v_note), now(),
        coalesce((p->>'photo_consent')::boolean, false),
        v_source, v_pay, v_status, v_hold, v_camp.total_price
      )
      returning id into v_id;
      v_ids := v_ids || v_id;
    end loop;
  exception when unique_violation then
    raise exception 'One of these athletes already has a spot at this camp' using errcode = '23505', hint = 'duplicate';
  end;

  -- The family is now the coach's client (by email; their account is linked when they sign in).
  perform public.camp_link_client(
    v_camp.coach_id, v_email, v_parent_name, btrim(v_athletes->0->>'first_name'), null, null
  );

  return jsonb_build_object(
    'signup_id', v_signup,
    'registration_ids', to_jsonb(v_ids),
    'status', v_status,
    'hold_expires_at', v_hold,
    'platform_waived', v_waived,
    'is_client', v_is_client,
    'superseded_sessions', to_jsonb(v_superseded),
    'camp', jsonb_build_object(
      'id', v_camp.id,
      'name', v_camp.package_name,
      'price_cents', v_camp.total_price,
      'starts_on', v_camp.camp_starts_on,
      'ends_on', v_camp.camp_ends_on,
      'location', v_camp.camp_location,
      'slug', v_camp.camp_slug,
      'coach_id', v_coach.id,
      'coach_name', v_coach.name,
      'coach_slug', v_coach.slug,
      'coach_email', v_coach.email
    ),
    'athletes', (
      select jsonb_agg(jsonb_build_object(
        'id', reg.id, 'first_name', reg.athlete_first_name, 'last_name', reg.athlete_last_name,
        'group_name', grp.name, 'start_time', to_char(grp.start_time, 'HH24:MI'), 'end_time', to_char(grp.end_time, 'HH24:MI')
      ) order by reg.created_at, reg.id)
      from public.camp_registrations as reg
      left join public.camp_groups as grp on grp.id = reg.group_id
      where reg.signup_id = v_signup
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.add_camp_athlete(p_camp_id uuid, p_group_id uuid, p_athlete_id uuid, p_first_name text, p_last_name text, p_birth_year integer, p_parent_email text, p_parent_name text, p_paid boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach uuid := public.current_coach_id();
  v_camp public.coach_packages%rowtype;
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last text := btrim(coalesce(p_last_name, ''));
  v_email text := nullif(lower(btrim(coalesce(p_parent_email, ''))), '');
  v_parent text := nullif(btrim(coalesce(p_parent_name, '')), '');
  v_birth integer := p_birth_year;
  v_user uuid;
  v_full text;
  v_dob date;
  v_signup uuid;
  v_id uuid;
  v_invite boolean;
  v_referral uuid;
  v_year integer := extract(year from now())::integer;
begin
  if v_coach is null then
    raise exception 'Only coaches can add athletes' using errcode = '42501';
  end if;
  select * into v_camp from public.coach_packages
  where id = p_camp_id and kind = 'camp' and coach_id = v_coach
  for update;
  if not found then
    raise exception 'Camp not found' using errcode = 'P0002';
  end if;
  if p_group_id is null then
    raise exception 'Pick a group' using errcode = '22023', hint = 'group_missing';
  end if;

  if p_athlete_id is not null then
    if not (
      public.is_coach_client(v_coach, p_athlete_id)
      or exists (select 1 from public.coach_slot_bookings where coach_id = v_coach and athlete_id = p_athlete_id)
      or exists (select 1 from public.coach_client_referrals where coach_id = v_coach and athlete_id = p_athlete_id)
    ) then
      raise exception 'That athlete is not in My athletes' using errcode = '42501';
    end if;
    select athlete.full_name, athlete.date_of_birth, athlete.user_id
      into v_full, v_dob, v_user
    from public.athlete_profiles as athlete where athlete.id = p_athlete_id;
    v_full := btrim(coalesce(v_full, ''));
    if v_first = '' then
      v_first := split_part(v_full, ' ', 1);
      v_last := btrim(substr(v_full, char_length(split_part(v_full, ' ', 1)) + 1));
    end if;
    v_birth := coalesce(v_birth, extract(year from v_dob)::integer);
    if v_user is not null then
      select coalesce(v_email, lower(up.email)), coalesce(v_parent, up.name)
        into v_email, v_parent
      from public.user_profiles as up where up.id = v_user;
    end if;
  end if;

  if char_length(v_first) not between 1 and 60 then
    raise exception 'Add a first name' using errcode = '22023';
  end if;
  if char_length(v_last) > 60 then
    raise exception 'Keep the last name under 60 characters' using errcode = '22023';
  end if;
  if v_birth is not null and v_birth not between v_year - 80 and v_year - 2 then
    raise exception 'Add a birth year, like 2013' using errcode = '22023';
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Add a real email address' using errcode = '22023';
  end if;
  if v_parent is not null and char_length(v_parent) > 120 then
    v_parent := left(v_parent, 120);
  end if;

  perform public.camp_reserve(v_camp.id, array[p_group_id]);

  insert into public.camp_signups (camp_id, coach_id, source, pay_method, parent_email, platform_waived, created_by,
                                   paid_at)
  values (v_camp.id, v_coach, 'coach', 'outside', v_email, true, auth.uid(), case when p_paid then now() end)
  returning id into v_signup;

  begin
    insert into public.camp_registrations (
      camp_id, group_id, signup_id, coach_id, parent_name, parent_email, athlete_first_name, athlete_last_name,
      birth_year, source, pay_method, status, hold_expires_at, price_cents, paid_at, user_id, athlete_id, created_by
    ) values (
      v_camp.id, p_group_id, v_signup, v_coach, v_parent, v_email, v_first, v_last,
      v_birth, 'coach', 'outside', case when p_paid then 'paid' else 'held' end, null, v_camp.total_price,
      case when p_paid then now() end, v_user, p_athlete_id, auth.uid()
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception '% already has a spot at this camp', v_first using errcode = '23505', hint = 'duplicate';
  end;

  -- A family without an account and not yet invited gets the usual invite (camp-signup resends
  -- the referral below); decided before the referral is created.
  v_invite := v_email is not null
    and v_user is null
    and not exists (select 1 from public.user_profiles where lower(email) = v_email)
    and not exists (
      select 1 from public.coach_client_referrals
      where coach_id = v_coach and lower(client_email) = v_email
    );
  -- The family is now the coach's client.
  v_referral := public.camp_link_client(v_coach, v_email, v_parent, v_first, v_user, p_athlete_id);

  return jsonb_build_object(
    'id', v_id,
    'signup_id', v_signup,
    'status', case when p_paid then 'paid' else 'held' end,
    'athlete_first_name', v_first,
    'parent_email', v_email,
    'parent_name', v_parent,
    'has_account', v_user is not null
      or (v_email is not null and exists (select 1 from public.user_profiles where lower(email) = v_email)),
    'invite_needed', v_invite,
    'referral_id', v_referral
  );
end;
$function$;

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
  v_athlete uuid;
  v_full text;
  v_claimed integer := 0;
  v_created integer := 0;
  v_client record;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select lower(u.email) into v_email
  from auth.users as u
  where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then
    return jsonb_build_object('claimed', 0, 'athletes_created', 0, 'email_confirmed', false);
  end if;

  update public.camp_registrations
    set user_id = v_uid
    where user_id is null and parent_email is not null and lower(parent_email) = v_email
      and status in ('pending_payment', 'held', 'paid');
  get diagnostics v_claimed = row_count;

  for v_reg in
    select reg.id, reg.athlete_first_name, reg.athlete_last_name, reg.birth_year
    from public.camp_registrations as reg
    where reg.user_id = v_uid and reg.athlete_id is null and reg.status in ('held', 'paid')
    order by reg.created_at
  loop
    v_full := btrim(v_reg.athlete_first_name || ' ' || v_reg.athlete_last_name);
    select athlete.id into v_athlete
    from public.athlete_profiles as athlete
    where athlete.user_id = v_uid and lower(btrim(athlete.full_name)) = lower(v_full)
    order by athlete.created_at
    limit 1;
    if v_athlete is null then
      -- Only the birth year is known; the family completes the profile later.
      begin
        insert into public.athlete_profiles (user_id, full_name, sport, date_of_birth, profile_completed)
        values (v_uid, v_full, 'Soccer', make_date(coalesce(v_reg.birth_year, extract(year from now())::integer - 10), 1, 1), false)
        returning id into v_athlete;
        v_created := v_created + 1;
      exception when unique_violation then
        -- One athlete profile per account (athlete_profiles_user_id_key): a second camp athlete
        -- stays on the registration by name instead of failing the whole claim.
        continue;
      end;
    end if;
    begin
      update public.camp_registrations set athlete_id = v_athlete where id = v_reg.id;
    exception when unique_violation then
      null; -- that profile already has a spot at this camp
    end;
  end loop;

  -- Camp families are the coach's clients: link each camp coach's referral to this account.
  for v_client in
    select distinct on (reg.coach_id) reg.coach_id, reg.parent_name, reg.athlete_first_name, reg.athlete_id
    from public.camp_registrations as reg
    where reg.user_id = v_uid and reg.status in ('pending_payment', 'held', 'paid')
    order by reg.coach_id, (reg.athlete_id is null), reg.created_at desc
  loop
    perform public.camp_link_client(
      v_client.coach_id, v_email, v_client.parent_name, v_client.athlete_first_name, v_uid, v_client.athlete_id
    );
  end loop;

  return jsonb_build_object('claimed', v_claimed, 'athletes_created', v_created, 'email_confirmed', true);
end;
$function$;

-- The older profile checkout (create-package-payment, kind 'camp'): the buyer is known, so the
-- relationship is linked to their account right away.
create or replace function public.camp_purchase_link_client()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_coach uuid;
begin
  if new.user_id is null or new.package_id is null or new.camp_signup_id is not null or new.status <> 'active' then
    return new;
  end if;
  select pkg.coach_id into v_coach
  from public.coach_packages as pkg
  where pkg.id = new.package_id and pkg.kind = 'camp';
  if v_coach is not null then
    perform public.camp_link_client(
      v_coach, null, (select up.name from public.user_profiles as up where up.id = new.user_id), null, new.user_id, null
    );
  end if;
  return new;
end;
$function$;

revoke all on function public.camp_purchase_link_client() from public, anon, authenticated;

drop trigger if exists camp_purchase_link_client on public.package_purchases;
create trigger camp_purchase_link_client
  after insert on public.package_purchases
  for each row execute function public.camp_purchase_link_client();
