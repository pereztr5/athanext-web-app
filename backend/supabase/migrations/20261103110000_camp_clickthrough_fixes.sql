-- Camp click-through fixes (Oct 28).
-- 1. Admins act on any coach's camp registrations, like they already view and edit them:
--    mark paid, cancel, add athlete, emails and the parent email go through camp_editor_coach_id
--    (the owner, or any coach's camp for an admin) instead of the caller's own coach id.
-- 2. camp_signup_status returns held_until, when a direct-pay hold is released, so the
--    "Your spot is held" page and email give the real pay-by date (it was the camp start).
-- 3. Riley's test camp went live without dates or a location in an old backfill; unpublish it
--    the way unpublish_camp does. save_camp already keeps a live camp from losing them.

CREATE OR REPLACE FUNCTION public.mark_camp_registration_paid(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reg public.camp_registrations%rowtype;
begin
  select * into v_reg from public.camp_registrations
  where id = p_id and coach_id = public.camp_editor_coach_id(camp_id);
  if not found then
    raise exception 'Registration not found' using errcode = 'P0002';
  end if;
  if v_reg.pay_method = 'card' then
    raise exception 'Card payments are confirmed by Stripe' using errcode = '22023', hint = 'card';
  end if;
  -- Camp row first (same lock order as sign-up), then the registration.
  perform 1 from public.coach_packages where id = v_reg.camp_id for update;
  select * into v_reg from public.camp_registrations where id = p_id for update;
  if v_reg.status = 'paid' then
    return jsonb_build_object('id', v_reg.id, 'status', 'paid');
  end if;
  if not public.camp_reg_holds_spot(v_reg.status, v_reg.hold_expires_at) then
    if v_reg.group_id is null then
      raise exception 'Pick a group for this athlete first' using errcode = '22023', hint = 'group_missing';
    end if;
    perform public.camp_reserve(v_reg.camp_id, array[v_reg.group_id]);
  end if;
  begin
    update public.camp_registrations
      set status = 'paid', paid_at = now(), hold_expires_at = null, cancelled_at = null, cancel_reason = null
      where id = v_reg.id;
  exception when unique_violation then
    raise exception 'This athlete already has a spot at this camp' using errcode = '23505', hint = 'duplicate';
  end;
  return jsonb_build_object('id', v_reg.id, 'status', 'paid');
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_camp_registration(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reg public.camp_registrations%rowtype;
begin
  select * into v_reg from public.camp_registrations
  where id = p_id and coach_id = public.camp_editor_coach_id(camp_id)
  for update;
  if not found then
    raise exception 'Registration not found' using errcode = 'P0002';
  end if;
  if v_reg.status = 'paid' and v_reg.pay_method = 'card' then
    raise exception 'Refund the card payment from Payments first' using errcode = '22023', hint = 'card_paid';
  end if;
  if v_reg.status in ('cancelled', 'expired') then
    return jsonb_build_object('id', v_reg.id, 'status', v_reg.status);
  end if;
  update public.camp_registrations
    set status = 'cancelled', cancelled_at = now(), hold_expires_at = null, cancel_reason = 'coach'
    where id = v_reg.id;
  return jsonb_build_object('id', v_reg.id, 'status', 'cancelled');
end;
$function$;

CREATE OR REPLACE FUNCTION public.camp_registration_contact(p_id uuid, p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reg public.camp_registrations%rowtype;
  v_last timestamptz;
begin
  if p_kind not in ('finish', 'details') then
    raise exception 'Unknown email' using errcode = '22023';
  end if;
  select * into v_reg from public.camp_registrations
  where id = p_id and coach_id = public.camp_editor_coach_id(camp_id)
  for update;
  if not found then
    raise exception 'Registration not found' using errcode = 'P0002';
  end if;
  if v_reg.parent_email is null then
    raise exception 'Add the parent''s email first' using errcode = '22023', hint = 'no_email';
  end if;
  v_last := case when p_kind = 'finish' then v_reg.finish_emailed_at else v_reg.details_emailed_at end;
  if v_last is not null and v_last > now() - interval '10 minutes' then
    raise exception 'Sent a few minutes ago. Try again later.' using errcode = 'P0001', hint = 'throttled';
  end if;
  if p_kind = 'finish' then
    update public.camp_registrations set finish_emailed_at = now() where id = p_id;
  else
    update public.camp_registrations set details_emailed_at = now() where id = p_id;
  end if;

  return (
    select jsonb_build_object(
      'registration_id', reg.id,
      'signup_id', reg.signup_id,
      'status', reg.status,
      'parent_email', reg.parent_email,
      'parent_name', reg.parent_name,
      'athlete_first_name', reg.athlete_first_name,
      'has_account', reg.user_id is not null
        or exists (select 1 from public.user_profiles as up where lower(up.email) = lower(reg.parent_email)),
      'group_name', grp.name,
      'start_time', to_char(grp.start_time, 'HH24:MI'),
      'end_time', to_char(grp.end_time, 'HH24:MI'),
      'camp', jsonb_build_object(
        'id', pkg.id, 'name', pkg.package_name, 'starts_on', pkg.camp_starts_on, 'ends_on', pkg.camp_ends_on,
        'location', pkg.camp_location, 'included', pkg.camp_included, 'slug', pkg.camp_slug,
        'coach_name', coach.name, 'coach_slug', coach.slug
      )
    )
    from public.camp_registrations as reg
    join public.coach_packages as pkg on pkg.id = reg.camp_id
    join public.coaches as coach on coach.id = pkg.coach_id
    left join public.camp_groups as grp on grp.id = reg.group_id
    where reg.id = p_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_camp_registration_parent_email(p_id uuid, p_email text, p_parent_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reg public.camp_registrations%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := nullif(btrim(coalesce(p_parent_name, '')), '');
begin
  if v_email = '' or char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Add a parent email' using errcode = '22023';
  end if;

  select * into v_reg from public.camp_registrations
  where id = p_id and coach_id = public.camp_editor_coach_id(camp_id)
  for update;
  if not found then
    raise exception 'Registration not found' using errcode = 'P0002';
  end if;
  if v_reg.status in ('cancelled', 'expired') then
    raise exception 'This spot is no longer active' using errcode = '22023';
  end if;

  update public.camp_registrations
    set parent_email = v_email,
        parent_name = coalesce(v_name, parent_name)
    where id = v_reg.id;

  if v_reg.signup_id is not null then
    update public.camp_signups
      set parent_email = coalesce(nullif(btrim(parent_email), ''), v_email)
      where id = v_reg.signup_id and coach_id = v_reg.coach_id;
  end if;

  perform public.camp_link_client(
    v_reg.coach_id, v_email, coalesce(v_name, v_reg.parent_name), v_reg.athlete_first_name, null, v_reg.athlete_id
  );

  return jsonb_build_object(
    'id', v_reg.id,
    'parent_email', v_email,
    'parent_name', coalesce(v_name, v_reg.parent_name)
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
  v_coach uuid := public.camp_editor_coach_id(p_camp_id);
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

CREATE OR REPLACE FUNCTION public.camp_signup_status(p_signup_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'signup_id', s.id,
    'pay_method', s.pay_method,
    'stripe_session_id', s.stripe_session_id,
    'parent_email', s.parent_email,
    'account_exists', exists (select 1 from public.user_profiles as up where lower(up.email) = lower(s.parent_email)),
    'camp', jsonb_build_object(
      'id', pkg.id, 'name', pkg.package_name, 'starts_on', pkg.camp_starts_on, 'ends_on', pkg.camp_ends_on,
      'location', pkg.camp_location, 'slug', pkg.camp_slug, 'included', pkg.camp_included,
      'coach_name', coach.name, 'coach_slug', coach.slug
    ),
    'athletes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', reg.id, 'first_name', reg.athlete_first_name, 'status', reg.status,
        'group_name', grp.name, 'start_time', to_char(grp.start_time, 'HH24:MI'), 'end_time', to_char(grp.end_time, 'HH24:MI')
      ) order by reg.created_at, reg.id)
      from public.camp_registrations as reg
      left join public.camp_groups as grp on grp.id = reg.group_id
      where reg.signup_id = s.id
    ), '[]'::jsonb),
    'held_until', (
      select min(hold_expires_at) from public.camp_registrations
      where signup_id = s.id and status = 'held' and hold_expires_at is not null
    ),
    'all_paid', not exists (select 1 from public.camp_registrations where signup_id = s.id and status <> 'paid'),
    'any_pending', exists (
      select 1 from public.camp_registrations
      where signup_id = s.id and status = 'pending_payment' and hold_expires_at > now()
    )
  )
  from public.camp_signups as s
  join public.coach_packages as pkg on pkg.id = s.camp_id
  join public.coaches as coach on coach.id = pkg.coach_id
  where s.id = p_signup_id and s.source in ('link', 'marketplace');
$function$;

update public.coach_packages
  set camp_published_at = null, is_active = false
  where kind = 'camp' and camp_published_at is not null and (camp_starts_on is null or camp_location is null);
select public.camp_sync_schedule(id) from public.coach_packages
  where id = 'baba5408-c67f-426b-85b7-d9226403206a';

notify pgrst, 'reload schema';
