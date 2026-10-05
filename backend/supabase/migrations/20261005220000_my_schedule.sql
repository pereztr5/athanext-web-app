-- ATH-71: My Schedule.
-- 1. Weekly sessions live in coach_session_series. fill_session_series() keeps their dated
--    sessions (coach_availability_slot_occurrences) filled through each coach's booking
--    window, or through ends_on for series with a fixed number of weeks. Availability
--    periods and weekly slots remain only for sessions created before this change.
-- 2. Dated sessions gain place, position, visibility (open / offered / clients), offered_to,
--    details, is_draft and disabled_reason. A removed week stays as a disabled row so the
--    series never fills it again.
-- 3. Booking requests are held 24 hours (coach_slot_bookings.expires_at, never later than
--    10 minutes after the session starts) and expired by cron.
-- 4. coaches.new_family_booking ('request' | 'instant') replaces requires_booking_confirmation
--    for families new to a coach; a coach's own families always book instantly.
--    coaches.booking_window_weeks sets how far ahead weekly sessions are filled.
-- 5. coach_time_off backs Clear day.
-- 6. Google Calendar: coach_calendar_connections (service role only) and coach_busy_blocks.
--    Busy blocks hide overlapping open sessions from families; they never delete anything.
-- All dates and times are Eastern wall time, like the rest of the scheduling code.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_coach_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profile.coach_id from public.user_profiles as profile where profile.id = auth.uid();
$$;

revoke all on function public.current_coach_id() from public, anon;
grant execute on function public.current_coach_id() to authenticated;

create or replace function public.eastern_timestamp(p_date date, p_time time)
returns timestamptz
language sql
stable
as $$
  select (p_date + p_time) at time zone 'America/New_York';
$$;

-- ---------------------------------------------------------------------------
-- Coach booking rules
-- ---------------------------------------------------------------------------

alter table public.coaches
  add column if not exists new_family_booking text not null default 'request',
  add column if not exists booking_window_weeks smallint not null default 4;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coaches_new_family_booking_check') then
    alter table public.coaches add constraint coaches_new_family_booking_check
      check (new_family_booking in ('request', 'instant'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coaches_booking_window_weeks_check') then
    alter table public.coaches add constraint coaches_booking_window_weeks_check
      check (booking_window_weeks between 1 and 12);
  end if;
end $$;

-- Keep each existing coach's current behaviour; new coaches start on 'request'.
update public.coaches
  set new_family_booking = case when requires_booking_confirmation then 'request' else 'instant' end;

comment on column public.coaches.new_family_booking is
  'ATH-71: request = families new to the coach send a request held 24h; instant = they book straight away. The coach''s own families always book instantly.';
comment on column public.coaches.booking_window_weeks is
  'ATH-71: how many weeks ahead weekly open sessions are filled.';
comment on column public.coaches.requires_booking_confirmation is
  'Deprecated by ATH-71 (new_family_booking). Kept until every reader is gone.';

-- ---------------------------------------------------------------------------
-- Weekly series
-- ---------------------------------------------------------------------------

create table if not exists public.coach_session_series (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  session_type text not null check (session_type in ('individual', 'group')),
  day_of_week smallint not null check (day_of_week between 1 and 7), -- ISO, 1 = Monday
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  session_name text not null check (char_length(session_name) between 1 and 120),
  price numeric not null check (price >= 0),
  max_bookings_per_slot integer not null default 1 check (max_bookings_per_slot between 1 and 100),
  location text not null check (location in ('online', 'in-person')),
  place text check (char_length(place) <= 200),
  pillar_slot text,
  position text check (position in ('Goalkeeper', 'Field player', 'Both')),
  visibility text not null default 'open' check (visibility in ('open', 'offered', 'clients')),
  offered_to uuid[] not null default '{}',
  details jsonb not null default '{}'::jsonb,
  starts_on date not null,
  ends_on date, -- null = every week until stopped
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_session_series_same_day
    check (extract(epoch from start_time) / 60 + duration_minutes <= 24 * 60),
  constraint coach_session_series_dates check (ends_on is null or ends_on >= starts_on)
);

create index if not exists coach_session_series_coach_idx on public.coach_session_series (coach_id) where is_active;

drop trigger if exists trg_coach_session_series_updated_at on public.coach_session_series;
create trigger trg_coach_session_series_updated_at
  before update on public.coach_session_series
  for each row execute function public.set_updated_at();

alter table public.coach_session_series enable row level security;

drop policy if exists "Coaches read their series" on public.coach_session_series;
create policy "Coaches read their series" on public.coach_session_series
  for select to authenticated using (coach_id = public.current_coach_id());

comment on table public.coach_session_series is
  'ATH-71: a session that repeats weekly. Written only through the schedule_* functions.';

-- ---------------------------------------------------------------------------
-- Dated sessions and bookings
-- ---------------------------------------------------------------------------

alter table public.coach_availability_slot_occurrences
  alter column weekly_slot_id drop not null,
  alter column availability_id drop not null,
  add column if not exists series_id uuid references public.coach_session_series(id) on delete set null,
  add column if not exists place text,
  add column if not exists position text,
  add column if not exists visibility text not null default 'open',
  add column if not exists offered_to uuid[] not null default '{}',
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists is_draft boolean not null default false,
  add column if not exists disabled_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'slot_occ_position') then
    alter table public.coach_availability_slot_occurrences add constraint slot_occ_position
      check (position in ('Goalkeeper', 'Field player', 'Both'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'slot_occ_visibility') then
    alter table public.coach_availability_slot_occurrences add constraint slot_occ_visibility
      check (visibility in ('open', 'offered', 'clients'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'slot_occ_disabled_reason') then
    alter table public.coach_availability_slot_occurrences add constraint slot_occ_disabled_reason
      check (disabled_reason in ('removed', 'time_off', 'replaced'));
  end if;
end $$;

create unique index if not exists slot_occ_series_date_key
  on public.coach_availability_slot_occurrences (series_id, occurrence_date)
  where series_id is not null;
create index if not exists slot_occ_coach_date_idx
  on public.coach_availability_slot_occurrences (coach_id, occurrence_date);

comment on column public.coach_availability_slot_occurrences.visibility is
  'ATH-71: open = listed for families; offered = only for offered_to athletes or anyone with the link; clients = only families who already train with the coach.';
comment on column public.coach_availability_slot_occurrences.disabled_reason is
  'ATH-71: why is_enabled is false. removed = coach removed this week; time_off = Clear day; replaced = another session took the time.';

alter table public.coach_slot_bookings
  alter column weekly_slot_id drop not null,
  alter column availability_id drop not null,
  add column if not exists expires_at timestamptz;

comment on column public.coach_slot_bookings.expires_at is
  'ATH-71: when a requested booking stops being held: 24 hours after the request, or 10 minutes after the session starts if sooner.';

create or replace function public.set_booking_request_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_starts timestamptz;
begin
  if new.status = 'requested'
     and (tg_op = 'INSERT' or old.status is distinct from 'requested' or new.expires_at is null) then
    select public.eastern_timestamp(occ.occurrence_date, occ.start_time) into v_starts
    from public.coach_availability_slot_occurrences as occ
    where occ.id = new.occurrence_id;
    new.expires_at := least(now() + interval '24 hours', coalesce(v_starts, now() + interval '24 hours') + interval '10 minutes');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bookings_request_expiry on public.coach_slot_bookings;
create trigger trg_bookings_request_expiry
  before insert or update of status on public.coach_slot_bookings
  for each row execute function public.set_booking_request_expiry();

update public.coach_slot_bookings as booking
  set expires_at = least(
    booking.created_at + interval '24 hours',
    public.eastern_timestamp(occ.occurrence_date, occ.start_time) + interval '10 minutes'
  )
  from public.coach_availability_slot_occurrences as occ
  where occ.id = booking.occurrence_id
    and booking.status = 'requested'
    and booking.expires_at is null;

create or replace function public.expire_booking_requests(p_coach_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.coach_slot_bookings
    set status = 'canceled',
        canceled_at = now(),
        cancellation_reason = 'Request expired',
        updated_at = now()
    where status = 'requested'
      and expires_at <= now()
      and (p_coach_id is null or coach_id = p_coach_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_booking_requests(uuid) from public, anon, authenticated;

-- Return type changes (expires_at, capacity), so drop first.
drop function if exists public.get_coach_booking_requests();
create function public.get_coach_booking_requests()
returns table(
  booking_id uuid, occurrence_id uuid, athlete_id uuid, athlete_name text, athlete_photo text,
  session_name text, session_type text, location text, place text, price numeric,
  occurrence_date date, start_time time, end_time time, notes text,
  requested_at timestamptz, expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
begin
  if v_coach_id is null then
    return;
  end if;

  perform public.expire_booking_requests(v_coach_id);

  return query
  select
    booking.id, occ.id, booking.athlete_id, athlete.full_name, athlete.profile_image_url,
    occ.session_name, occ.session_type::text, occ.location::text, occ.place, occ.price,
    occ.occurrence_date, occ.start_time, occ.end_time, booking.notes,
    booking.created_at, booking.expires_at
  from public.coach_slot_bookings as booking
  join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
  left join public.athlete_profiles as athlete on athlete.id = booking.athlete_id
  where booking.coach_id = v_coach_id
    and booking.status = 'requested'
  order by booking.expires_at, occ.occurrence_date, occ.start_time;
end;
$$;

revoke all on function public.get_coach_booking_requests() from public, anon;
grant execute on function public.get_coach_booking_requests() to authenticated;

create or replace function public.respond_to_booking_request(p_booking_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
begin
  select booking.status::text as status, booking.expires_at
    into v_booking
  from public.coach_slot_bookings as booking
  where booking.id = p_booking_id
    and booking.coach_id = public.current_coach_id()
  for update of booking;

  if v_booking.status is null then
    raise exception 'Booking request not found' using errcode = '42501';
  end if;
  if v_booking.status <> 'requested' then
    raise exception 'This request was already answered' using errcode = '22023';
  end if;
  if p_accept and v_booking.expires_at is not null and v_booking.expires_at <= now() then
    perform public.expire_booking_requests(public.current_coach_id());
    raise exception 'This request has expired, so it can no longer be accepted' using errcode = '22023';
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

-- ---------------------------------------------------------------------------
-- Time off
-- ---------------------------------------------------------------------------

create table if not exists public.coach_time_off (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  off_date date not null,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (coach_id, off_date)
);

alter table public.coach_time_off enable row level security;

drop policy if exists "Coaches read their time off" on public.coach_time_off;
create policy "Coaches read their time off" on public.coach_time_off
  for select to authenticated using (coach_id = public.current_coach_id());

-- ---------------------------------------------------------------------------
-- Google Calendar
-- ---------------------------------------------------------------------------

create table if not exists public.coach_calendar_connections (
  coach_id uuid primary key references public.coaches(id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  account_email text,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  last_synced_at timestamptz,
  sync_error text,
  connected_at timestamptz not null default now()
);

-- Tokens: service role only. No policies, no grants.
alter table public.coach_calendar_connections enable row level security;
revoke all on table public.coach_calendar_connections from anon, authenticated;

create table if not exists public.coach_busy_blocks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null default 'google',
  constraint coach_busy_blocks_range check (ends_at > starts_at)
);

create index if not exists coach_busy_blocks_coach_idx on public.coach_busy_blocks (coach_id, starts_at);

alter table public.coach_busy_blocks enable row level security;

drop policy if exists "Coaches read their busy times" on public.coach_busy_blocks;
create policy "Coaches read their busy times" on public.coach_busy_blocks
  for select to authenticated using (coach_id = public.current_coach_id());

create or replace function public.coach_is_busy(p_coach_id uuid, p_date date, p_start time, p_end time)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coach_busy_blocks as busy
    where busy.coach_id = p_coach_id
      and busy.starts_at < public.eastern_timestamp(p_date, p_end)
      and public.eastern_timestamp(p_date, p_start) < busy.ends_at
  );
$$;

revoke all on function public.coach_is_busy(uuid, date, time, time) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Filling series
-- ---------------------------------------------------------------------------

-- Fills each active series from today (or starts_on) through ends_on, or through the
-- coach's booking window when it repeats with no end. A date is skipped when the series
-- already has a row for it (including removed weeks), the coach has the day off, the
-- time has passed, or another enabled session overlaps. Returns the number added.
create or replace function public.fill_session_series(p_series_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('America/New_York', now()))::date;
  v_series record;
  v_date date;
  v_until date;
  v_end time;
  v_added integer := 0;
begin
  -- App callers fill their own series; the cron job (no JWT) fills all.
  if auth.uid() is not null and (
    p_series_id is null
    or not exists (
      select 1 from public.coach_session_series as series
      where series.id = p_series_id and series.coach_id = public.current_coach_id()
    )
  ) then
    raise exception 'Series not found' using errcode = '42501';
  end if;

  for v_series in
    select series.*, coach.booking_window_weeks
    from public.coach_session_series as series
    join public.coaches as coach on coach.id = series.coach_id
    where series.is_active
      and (p_series_id is null or series.id = p_series_id)
      and (series.ends_on is null or series.ends_on >= v_today)
  loop
    v_end := v_series.start_time + make_interval(mins => v_series.duration_minutes);
    v_until := coalesce(v_series.ends_on, v_today + v_series.booking_window_weeks * 7);
    v_date := greatest(v_series.starts_on, v_today);
    v_date := v_date + ((v_series.day_of_week - extract(isodow from v_date)::int + 7) % 7);

    while v_date <= v_until loop
      if public.eastern_timestamp(v_date, v_series.start_time) > now()
        and not exists (
          select 1 from public.coach_availability_slot_occurrences as occ
          where occ.series_id = v_series.id and occ.occurrence_date = v_date
        )
        and not exists (
          select 1 from public.coach_time_off as off
          where off.coach_id = v_series.coach_id and off.off_date = v_date
        )
        and not exists (
          select 1 from public.coach_availability_slot_occurrences as other
          where other.coach_id = v_series.coach_id
            and other.occurrence_date = v_date
            and other.is_enabled
            and other.start_time < v_end
            and v_series.start_time < other.end_time
        )
      then
        insert into public.coach_availability_slot_occurrences (
          series_id, coach_id, occurrence_date, session_name, price, duration_minutes,
          start_time, end_time, session_type, location, place, pillar_slot, position,
          visibility, offered_to, details, is_enabled, max_bookings_per_slot
        ) values (
          v_series.id, v_series.coach_id, v_date, v_series.session_name, v_series.price,
          v_series.duration_minutes, v_series.start_time, v_end, v_series.session_type,
          v_series.location, v_series.place, v_series.pillar_slot, v_series.position,
          v_series.visibility, v_series.offered_to, v_series.details, true,
          v_series.max_bookings_per_slot
        );
        v_added := v_added + 1;
      end if;
      v_date := v_date + 7;
    end loop;
  end loop;

  return v_added;
end;
$$;

revoke all on function public.fill_session_series(uuid) from public, anon;
grant execute on function public.fill_session_series(uuid) to authenticated;

-- Repeating availability periods become series starting the week after their last
-- generated week; their existing occurrences stay as they are.
do $$
declare
  v_period record;
  v_occ record;
begin
  for v_period in
    select availability.id, availability.coach_id, availability.end_date
    from public.coach_availability as availability
    where availability.repeats_weekly
  loop
    for v_occ in
      select occ.*
      from public.coach_availability_slot_occurrences as occ
      where occ.availability_id = v_period.id
        and occ.is_enabled
        and occ.occurrence_date > v_period.end_date - 7
        and occ.occurrence_date <= v_period.end_date
    loop
      insert into public.coach_session_series (
        coach_id, session_type, day_of_week, start_time, duration_minutes, session_name,
        price, max_bookings_per_slot, location, pillar_slot, starts_on
      ) values (
        v_period.coach_id, v_occ.session_type, extract(isodow from v_occ.occurrence_date)::smallint,
        v_occ.start_time, v_occ.duration_minutes, v_occ.session_name, v_occ.price,
        v_occ.max_bookings_per_slot, v_occ.location, v_occ.pillar_slot, v_occ.occurrence_date + 7
      );
    end loop;
    update public.coach_availability set repeats_weekly = false where id = v_period.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Coach actions
-- ---------------------------------------------------------------------------

-- Unbooked, enabled occurrences of a series from today on are dropped: deleted when they
-- never had a booking, otherwise detached and disabled so their history stays.
create or replace function public.schedule_drop_future(p_series_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('America/New_York', now()))::date;
  v_count integer := 0;
  v_n integer;
begin
  delete from public.coach_availability_slot_occurrences as occ
  where occ.series_id = p_series_id
    and occ.occurrence_date >= v_today
    and not exists (select 1 from public.coach_slot_bookings as b where b.occurrence_id = occ.id);
  get diagnostics v_n = row_count;
  v_count := v_n;

  update public.coach_availability_slot_occurrences as occ
    set series_id = null, is_enabled = false, disabled_reason = 'removed'
  where occ.series_id = p_series_id
    and occ.occurrence_date >= v_today
    and occ.is_enabled
    and not exists (
      select 1 from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
    );
  get diagnostics v_n = row_count;
  return v_count + v_n;
end;
$$;

revoke all on function public.schedule_drop_future(uuid) from public, anon, authenticated;

-- Creates one-time sessions or weekly series. p_session:
--   session_type 'individual' | 'group'; visibility 'open' | 'offered' | 'clients';
--   times [{date, start}] (Eastern); repeat 'none' | 'weekly' (no end) | 'weeks' (+ weeks 1-26);
--   duration_minutes, session_name, price, capacity, location, place, pillar, position,
--   details, is_draft, offered_to.
-- A new session that isn't an open slot takes over an overlapping open 1-on-1 slot that
-- has no bookings. Anything else that overlaps is skipped and reported.
create or replace function public.schedule_create_sessions(p_session jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_type text := coalesce(p_session->>'session_type', 'individual');
  v_visibility text := coalesce(p_session->>'visibility', 'open');
  v_repeat text := coalesce(p_session->>'repeat', 'none');
  v_weeks integer := coalesce((p_session->>'weeks')::integer, 1);
  v_duration integer := (p_session->>'duration_minutes')::integer;
  v_name text := nullif(trim(p_session->>'session_name'), '');
  v_price numeric := (p_session->>'price')::numeric;
  v_capacity integer := case when v_type = 'group' then coalesce((p_session->>'capacity')::integer, 6) else 1 end;
  v_location text := coalesce(p_session->>'location', 'in-person');
  v_place text := nullif(trim(p_session->>'place'), '');
  v_pillar text := nullif(trim(p_session->>'pillar'), '');
  v_position text := nullif(p_session->>'position', '');
  v_details jsonb := coalesce(p_session->'details', '{}'::jsonb);
  v_draft boolean := coalesce((p_session->>'is_draft')::boolean, false);
  v_offered uuid[] := coalesce(
    (select array_agg(value::uuid) from jsonb_array_elements_text(coalesce(p_session->'offered_to', '[]'::jsonb))),
    '{}'
  );
  v_time jsonb;
  v_date date;
  v_start time;
  v_end time;
  v_series_id uuid;
  v_occ_id uuid;
  v_created uuid[] := '{}';
  v_series uuid[] := '{}';
  v_skipped jsonb := '[]'::jsonb;
  v_planned date;
  v_last date;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can create sessions' using errcode = '42501';
  end if;
  if v_type not in ('individual', 'group') then
    raise exception 'Unknown session type' using errcode = '22023';
  end if;
  if v_repeat not in ('none', 'weekly', 'weeks') or v_weeks not between 1 and 26 then
    raise exception 'Unknown repeat' using errcode = '22023';
  end if;
  if v_duration is null or v_price is null then
    raise exception 'Length and price are required' using errcode = '22023';
  end if;
  if v_type = 'group' and v_name is null then
    raise exception 'Name the group session' using errcode = '22023';
  end if;
  if v_draft and v_repeat <> 'none' then
    raise exception 'Drafts are one-time sessions' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_session->'times', '[]'::jsonb)) = 0 then
    raise exception 'Pick a time' using errcode = '22023';
  end if;
  v_name := coalesce(v_name, '1-on-1 session');

  for v_time in select * from jsonb_array_elements(p_session->'times') loop
    v_date := (v_time->>'date')::date;
    v_start := (v_time->>'start')::time;
    v_end := v_start + make_interval(mins => v_duration);
    if extract(epoch from v_start) / 60 + v_duration > 24 * 60 then
      raise exception 'Sessions must end before midnight' using errcode = '22023';
    end if;
    if public.eastern_timestamp(v_date, v_start) <= now() then
      raise exception 'Pick a time that hasn''t passed' using errcode = '22023';
    end if;

    if v_repeat = 'none' then
      if v_visibility <> 'open' then
        update public.coach_availability_slot_occurrences as occ
          set is_enabled = false, disabled_reason = 'replaced'
        where occ.coach_id = v_coach_id and occ.occurrence_date = v_date and occ.is_enabled
          and occ.session_type = 'individual' and occ.visibility = 'open'
          and occ.start_time < v_end and v_start < occ.end_time
          and not exists (
            select 1 from public.coach_slot_bookings as b
            where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
          );
      end if;
      if exists (
        select 1 from public.coach_availability_slot_occurrences as other
        where other.coach_id = v_coach_id and other.occurrence_date = v_date and other.is_enabled
          and other.start_time < v_end and v_start < other.end_time
      ) then
        v_skipped := v_skipped || jsonb_build_object('date', v_date, 'start', v_start);
        continue;
      end if;
      insert into public.coach_availability_slot_occurrences (
        coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
        session_type, location, place, pillar_slot, position, visibility, offered_to, details,
        is_draft, is_enabled, max_bookings_per_slot
      ) values (
        v_coach_id, v_date, v_name, v_price, v_duration, v_start, v_end, v_type, v_location,
        v_place, v_pillar, v_position, v_visibility, v_offered, v_details, v_draft, true, v_capacity
      ) returning id into v_occ_id;
      v_created := v_created || v_occ_id;
    else
      v_last := case when v_repeat = 'weeks' then v_date + (v_weeks - 1) * 7 else null end;
      insert into public.coach_session_series (
        coach_id, session_type, day_of_week, start_time, duration_minutes, session_name, price,
        max_bookings_per_slot, location, place, pillar_slot, position, visibility, offered_to,
        details, starts_on, ends_on
      ) values (
        v_coach_id, v_type, extract(isodow from v_date)::smallint, v_start, v_duration, v_name,
        v_price, v_capacity, v_location, v_place, v_pillar, v_position, v_visibility, v_offered,
        v_details, v_date, v_last
      ) returning id into v_series_id;
      v_series := v_series || v_series_id;

      if v_visibility <> 'open' then
        update public.coach_availability_slot_occurrences as occ
          set is_enabled = false, disabled_reason = 'replaced'
        where occ.coach_id = v_coach_id and occ.is_enabled
          and occ.session_type = 'individual' and occ.visibility = 'open'
          and occ.occurrence_date >= v_date
          and (v_last is null or occ.occurrence_date <= v_last)
          and extract(isodow from occ.occurrence_date) = extract(isodow from v_date)
          and occ.start_time < v_end and v_start < occ.end_time
          and not exists (
            select 1 from public.coach_slot_bookings as b
            where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
          );
      end if;

      perform public.fill_session_series(v_series_id);

      -- Report the dates in the first stretch that couldn't be filled.
      v_planned := v_date;
      while v_planned <= coalesce(
        v_last,
        (timezone('America/New_York', now()))::date
          + (select booking_window_weeks from public.coaches where id = v_coach_id) * 7
      ) loop
        if not exists (
          select 1 from public.coach_availability_slot_occurrences
          where series_id = v_series_id and occurrence_date = v_planned
        ) then
          v_skipped := v_skipped || jsonb_build_object('date', v_planned, 'start', v_start);
        end if;
        v_planned := v_planned + 7;
      end loop;

      v_created := v_created || coalesce(
        (select array_agg(id order by occurrence_date) from public.coach_availability_slot_occurrences where series_id = v_series_id),
        '{}'
      );
    end if;
  end loop;

  return jsonb_build_object('created', to_jsonb(v_created), 'series', to_jsonb(v_series), 'skipped', v_skipped);
end;
$$;

revoke all on function public.schedule_create_sessions(jsonb) from public, anon;
grant execute on function public.schedule_create_sessions(jsonb) to authenticated;

-- Removes one dated session the coach owns. Sessions with live bookings can't be removed.
-- The row stays disabled, so a series doesn't fill that week again and history is kept.
create or replace function public.schedule_remove_session(p_occurrence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.coach_availability_slot_occurrences
    where id = p_occurrence_id and coach_id = public.current_coach_id()
  ) then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.coach_slot_bookings
    where occurrence_id = p_occurrence_id and status in ('requested', 'pending_payment', 'booked')
  ) then
    raise exception 'This session has bookings. Cancel them first.' using errcode = '22023';
  end if;
  update public.coach_availability_slot_occurrences
    set is_enabled = false, disabled_reason = 'removed'
    where id = p_occurrence_id;
end;
$$;

revoke all on function public.schedule_remove_session(uuid) from public, anon;
grant execute on function public.schedule_remove_session(uuid) to authenticated;

-- Changes a series for every week from today: new start time and/or place.
-- Booked sessions stay as they are.
create or replace function public.schedule_update_series(
  p_series_id uuid, p_start_time time, p_location text, p_place text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('America/New_York', now()))::date;
begin
  if not exists (
    select 1 from public.coach_session_series
    where id = p_series_id and coach_id = public.current_coach_id() and is_active
  ) then
    raise exception 'Series not found' using errcode = '42501';
  end if;
  perform public.schedule_drop_future(p_series_id);
  update public.coach_session_series
    set start_time = coalesce(p_start_time, start_time),
        location = coalesce(p_location, location),
        place = case when p_place is null then place else nullif(trim(p_place), '') end,
        starts_on = greatest(starts_on, v_today)
    where id = p_series_id;
  return public.fill_session_series(p_series_id);
end;
$$;

revoke all on function public.schedule_update_series(uuid, time, text, text) from public, anon;
grant execute on function public.schedule_update_series(uuid, time, text, text) to authenticated;

create or replace function public.schedule_stop_series(p_series_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dropped integer;
begin
  if not exists (
    select 1 from public.coach_session_series
    where id = p_series_id and coach_id = public.current_coach_id()
  ) then
    raise exception 'Series not found' using errcode = '42501';
  end if;
  v_dropped := public.schedule_drop_future(p_series_id);
  update public.coach_session_series set is_active = false where id = p_series_id;
  return v_dropped;
end;
$$;

revoke all on function public.schedule_stop_series(uuid) from public, anon;
grant execute on function public.schedule_stop_series(uuid) to authenticated;

-- Clear day: marks the day off and closes its open 1-on-1 slots that have no bookings.
-- Booked, offered and group sessions stay. Returns the number of slots closed.
create or replace function public.schedule_clear_day(p_date date, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_count integer;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can clear a day' using errcode = '42501';
  end if;
  insert into public.coach_time_off (coach_id, off_date, note)
    values (v_coach_id, p_date, nullif(trim(p_note), ''))
    on conflict (coach_id, off_date) do update set note = excluded.note;

  update public.coach_availability_slot_occurrences as occ
    set is_enabled = false, disabled_reason = 'time_off'
  where occ.coach_id = v_coach_id and occ.occurrence_date = p_date and occ.is_enabled
    and occ.session_type = 'individual' and occ.visibility = 'open'
    and not exists (
      select 1 from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.schedule_clear_day(date, text) from public, anon;
grant execute on function public.schedule_clear_day(date, text) to authenticated;

-- Undo Clear day: the day is a working day again and the slots it closed come back,
-- unless something else has taken their time since.
create or replace function public.schedule_restore_day(p_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_occ record;
  v_count integer := 0;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can restore a day' using errcode = '42501';
  end if;
  delete from public.coach_time_off where coach_id = v_coach_id and off_date = p_date;

  for v_occ in
    select occ.id, occ.start_time, occ.end_time
    from public.coach_availability_slot_occurrences as occ
    where occ.coach_id = v_coach_id and occ.occurrence_date = p_date
      and not occ.is_enabled and occ.disabled_reason = 'time_off'
    order by occ.start_time
  loop
    if not exists (
      select 1 from public.coach_availability_slot_occurrences as other
      where other.coach_id = v_coach_id and other.occurrence_date = p_date and other.is_enabled
        and other.start_time < v_occ.end_time and v_occ.start_time < other.end_time
    ) then
      update public.coach_availability_slot_occurrences
        set is_enabled = true, disabled_reason = null
        where id = v_occ.id;
      v_count := v_count + 1;
    end if;
  end loop;

  perform public.fill_session_series(series.id)
  from public.coach_session_series as series
  where series.coach_id = v_coach_id and series.is_active;
  return v_count;
end;
$$;

revoke all on function public.schedule_restore_day(date) from public, anon;
grant execute on function public.schedule_restore_day(date) to authenticated;

create or replace function public.schedule_set_rules(p_new_family_booking text, p_booking_window_weeks integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
begin
  if v_coach_id is null then
    raise exception 'Only coaches have booking rules' using errcode = '42501';
  end if;
  update public.coaches
    set new_family_booking = coalesce(p_new_family_booking, new_family_booking),
        booking_window_weeks = coalesce(p_booking_window_weeks, booking_window_weeks)
    where id = v_coach_id;
  perform public.fill_session_series(series.id)
  from public.coach_session_series as series
  where series.coach_id = v_coach_id and series.is_active;
end;
$$;

revoke all on function public.schedule_set_rules(text, integer) from public, anon;
grant execute on function public.schedule_set_rules(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Reading the schedule
-- ---------------------------------------------------------------------------

-- Everything My Schedule shows for p_from..p_to (Eastern dates): enabled sessions with
-- their live bookings, busy times, days off, active series, booking rules and calendar status.
create or replace function public.get_coach_schedule(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
begin
  if v_coach_id is null then
    raise exception 'Only coaches have a schedule' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'Pick a range of up to 62 days' using errcode = '22023';
  end if;

  perform public.expire_booking_requests(v_coach_id);

  return jsonb_build_object(
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', occ.id,
        'date', occ.occurrence_date,
        'start_time', occ.start_time,
        'end_time', occ.end_time,
        'duration_minutes', occ.duration_minutes,
        'session_type', occ.session_type,
        'session_name', occ.session_name,
        'price', occ.price,
        'capacity', occ.max_bookings_per_slot,
        'location', occ.location,
        'place', occ.place,
        'pillar', occ.pillar_slot,
        'position', occ.position,
        'visibility', occ.visibility,
        'offered_to', occ.offered_to,
        'offered_names', coalesce((
          select jsonb_agg(athlete.full_name order by athlete.full_name)
          from public.athlete_profiles as athlete
          where athlete.id = any(occ.offered_to)
        ), '[]'::jsonb),
        'details', occ.details,
        'is_draft', occ.is_draft,
        'series_id', occ.series_id,
        'bookings', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', b.id,
            'athlete_id', b.athlete_id,
            'athlete_name', athlete.full_name,
            'status', b.status,
            'payment_status', b.payment_status,
            'expires_at', b.expires_at,
            'notes', b.notes,
            'created_at', b.created_at
          ) order by b.created_at)
          from public.coach_slot_bookings as b
          left join public.athlete_profiles as athlete on athlete.id = b.athlete_id
          where b.occurrence_id = occ.id
            and b.status in ('requested', 'pending_payment', 'booked', 'completed', 'no_show')
        ), '[]'::jsonb)
      ) order by occ.occurrence_date, occ.start_time)
      from public.coach_availability_slot_occurrences as occ
      where occ.coach_id = v_coach_id
        and occ.is_enabled
        and occ.occurrence_date between p_from and p_to
    ), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object('starts_at', busy.starts_at, 'ends_at', busy.ends_at) order by busy.starts_at)
      from public.coach_busy_blocks as busy
      where busy.coach_id = v_coach_id
        and busy.ends_at > public.eastern_timestamp(p_from, '00:00')
        and busy.starts_at < public.eastern_timestamp(p_to + 1, '00:00')
    ), '[]'::jsonb),
    'time_off', coalesce((
      select jsonb_agg(jsonb_build_object('date', off.off_date, 'note', off.note) order by off.off_date)
      from public.coach_time_off as off
      where off.coach_id = v_coach_id and off.off_date between p_from and p_to
    ), '[]'::jsonb),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', series.id,
        'session_type', series.session_type,
        'day_of_week', series.day_of_week,
        'start_time', series.start_time,
        'duration_minutes', series.duration_minutes,
        'location', series.location,
        'place', series.place,
        'ends_on', series.ends_on
      ))
      from public.coach_session_series as series
      where series.coach_id = v_coach_id and series.is_active
    ), '[]'::jsonb),
    'rules', (
      select jsonb_build_object(
        'new_family_booking', coach.new_family_booking,
        'booking_window_weeks', coach.booking_window_weeks,
        'locations', coalesce(to_jsonb(coach.locations), '[]'::jsonb),
        'hourly_rate', coach.hourly_rate,
        'slug', coach.slug
      )
      from public.coaches as coach where coach.id = v_coach_id
    ),
    'calendar', (
      select jsonb_build_object(
        'connected', true,
        'account_email', conn.account_email,
        'last_synced_at', conn.last_synced_at,
        'sync_error', conn.sync_error
      )
      from public.coach_calendar_connections as conn where conn.coach_id = v_coach_id
    )
  );
end;
$$;

revoke all on function public.get_coach_schedule(date, date) from public, anon;
grant execute on function public.get_coach_schedule(date, date) to authenticated;

-- Families keep reading availability through get_coach_availability until the new booking
-- flow lands. Sessions created in My Schedule have no availability period, so they come
-- back as one extra period (id = coach id). For anyone but the coach, that period lists
-- only open, published sessions that aren't hidden by a Google Calendar busy time.
create or replace function public.get_coach_availability(coach_id_param uuid)
returns table(
  id uuid, coach_id uuid, start_date date, end_date date, created_at timestamptz,
  updated_at timestamptz, weekly_slots jsonb, occurrences jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.coach_id, a.start_date, a.end_date, a.created_at, a.updated_at,
    coalesce((
      select jsonb_agg(to_jsonb(ws) order by ws.day_of_week, ws.start_time)
      from public.coach_availability_weekly_slots ws where ws.availability_id = a.id
    ), '[]'::jsonb) as weekly_slots,
    coalesce((
      select jsonb_agg(to_jsonb(occ) order by occ.occurrence_date, occ.start_time)
      from public.coach_availability_slot_occurrences occ where occ.availability_id = a.id
    ), '[]'::jsonb) as occurrences
  from public.coach_availability a
  where a.coach_id = coach_id_param
  union all
  select coach_id_param, coach_id_param, min(occ.occurrence_date), max(occ.occurrence_date),
    min(occ.created_at), max(occ.updated_at), '[]'::jsonb,
    jsonb_agg(to_jsonb(occ) order by occ.occurrence_date, occ.start_time)
  from public.coach_availability_slot_occurrences occ
  where occ.coach_id = coach_id_param
    and occ.availability_id is null
    and occ.is_enabled
    and (
      coach_id_param = public.current_coach_id()
      or (
        occ.visibility = 'open'
        and not occ.is_draft
        and not public.coach_is_busy(occ.coach_id, occ.occurrence_date, occ.start_time, occ.end_time)
      )
    )
  having count(*) > 0
  order by 3 desc, 5 desc;
$$;

-- ---------------------------------------------------------------------------
-- Cron
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from cron.job where jobname = 'extend-rolling-availability') then
    perform cron.unschedule('extend-rolling-availability');
  end if;
end $$;

select cron.schedule('fill-session-series', '15 5 * * *', $$select public.fill_session_series()$$);
select cron.schedule('expire-booking-requests', '*/10 * * * *', $$select public.expire_booking_requests()$$);
