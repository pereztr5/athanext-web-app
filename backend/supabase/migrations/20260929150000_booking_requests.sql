-- ATH-49: coaches can require confirmation before an individual session is booked.
-- A request is held as coach_slot_bookings.status = 'requested' (no Stripe session).
-- Accept moves it to 'pending_payment' so the athlete pays through the normal flow;
-- decline cancels it. Group sessions keep instant checkout.

alter table public.coaches
  add column if not exists requires_booking_confirmation boolean not null default false;

comment on column public.coaches.requires_booking_confirmation is
  'ATH-49: individual sessions are requested and held until the coach accepts or declines.';

-- Allow the new status whether it is an enum or a CHECK list (the base table is not in this repo).
do $$
declare
  v_udt text;
  v_con record;
  v_def text;
begin
  select c.udt_name into v_udt
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'coach_slot_bookings' and c.column_name = 'status';

  if exists (select 1 from pg_type t where t.typname = v_udt and t.typtype = 'e') then
    execute format('alter type public.%I add value if not exists %L', v_udt, 'requested');
  end if;

  for v_con in
    select con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    where con.conrelid = 'public.coach_slot_bookings'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%pending_payment%'
      and pg_get_constraintdef(con.oid) not ilike '%requested%'
  loop
    v_def := replace(v_con.def, '''pending_payment''::text', '''pending_payment''::text, ''requested''::text');
    if v_def = v_con.def then
      v_def := replace(v_con.def, '''pending_payment''', '''pending_payment'', ''requested''');
    end if;
    execute format('alter table public.coach_slot_bookings drop constraint %I', v_con.conname);
    execute format('alter table public.coach_slot_bookings add constraint %I %s', v_con.conname, v_def);
  end loop;
end $$;

-- Coach accepts (-> pending_payment) or declines (-> canceled) one of their own requests.
create or replace function public.respond_to_booking_request(p_booking_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select booking.status::text into v_status
  from public.coach_slot_bookings as booking
  join public.user_profiles as profile on profile.coach_id = booking.coach_id
  where booking.id = p_booking_id
    and profile.id = auth.uid()
  for update of booking;

  if v_status is null then
    raise exception 'Booking request not found' using errcode = '42501';
  end if;
  if v_status <> 'requested' then
    raise exception 'This request was already answered' using errcode = '22023';
  end if;

  -- Same Eastern booking window as checkout: open until 10 minutes after start.
  if p_accept and exists (
    select 1
    from public.coach_slot_bookings as booking
    join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
    where booking.id = p_booking_id
      and ((occ.occurrence_date + occ.start_time) at time zone 'America/New_York') + interval '10 minutes' < now()
  ) then
    raise exception 'This session has already started, so the request can no longer be accepted'
      using errcode = '22023';
  end if;

  if p_accept then
    update public.coach_slot_bookings
      set status = 'pending_payment', updated_at = now()
      where id = p_booking_id;
    return 'pending_payment';
  end if;

  update public.coach_slot_bookings
    set status = 'canceled',
        canceled_at = now(),
        cancellation_reason = 'Declined by coach',
        updated_at = now()
    where id = p_booking_id;
  return 'canceled';
end;
$$;

revoke all on function public.respond_to_booking_request(uuid, boolean) from public, anon;
grant execute on function public.respond_to_booking_request(uuid, boolean) to authenticated;

-- Open requests for the calling coach, with the session and athlete details the list needs.
create or replace function public.get_coach_booking_requests()
returns table (
  booking_id uuid,
  occurrence_id uuid,
  athlete_id uuid,
  athlete_name text,
  athlete_photo text,
  session_name text,
  session_type text,
  location text,
  price numeric,
  occurrence_date date,
  start_time time,
  end_time time,
  notes text,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
begin
  select profile.coach_id into v_coach_id
  from public.user_profiles as profile
  where profile.id = auth.uid();
  if v_coach_id is null then
    return;
  end if;

  -- Requests the coach never answered expire once the booking window closes,
  -- so they stop holding capacity. (::text so this works for an enum status too.)
  update public.coach_slot_bookings as booking
    set status = 'canceled',
        canceled_at = now(),
        cancellation_reason = 'Request expired',
        updated_at = now()
    from public.coach_availability_slot_occurrences as occ
    where occ.id = booking.occurrence_id
      and booking.coach_id = v_coach_id
      and booking.status::text = 'requested'
      and ((occ.occurrence_date + occ.start_time) at time zone 'America/New_York') + interval '10 minutes' < now();

  return query
  select
    booking.id,
    occ.id,
    booking.athlete_id,
    athlete.full_name,
    athlete.profile_image_url,
    occ.session_name,
    occ.session_type::text,
    occ.location::text,
    occ.price,
    occ.occurrence_date,
    occ.start_time,
    occ.end_time,
    booking.notes,
    booking.created_at
  from public.coach_slot_bookings as booking
  join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
  left join public.athlete_profiles as athlete on athlete.id = booking.athlete_id
  where booking.coach_id = v_coach_id
    and booking.status::text = 'requested'
  order by occ.occurrence_date, occ.start_time;
end;
$$;

revoke all on function public.get_coach_booking_requests() from public, anon;
grant execute on function public.get_coach_booking_requests() to authenticated;

-- Account deletion also cancels open requests (same body as 20260926231625, plus 'requested').
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
      and booking.status::text in ('booked', 'pending_payment', 'requested')
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
