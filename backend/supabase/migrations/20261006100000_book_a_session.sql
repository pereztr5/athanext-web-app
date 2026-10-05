-- ATH-73: athlete Book a Session.
-- 1. Pillars follow the prototype: On-field training (Technical and Tactical merged),
--    Video analysis, Mentorship, Performance coaching (was Strength + Conditioning),
--    Academic tutoring, College recruiting. sport_pillars holds the real list and stored
--    pillar names are renamed to match.
-- 2. What families can book, in one place: visible_sessions() applies drafts, visibility,
--    Google busy times, started sessions and capacity for the signed-in family.
-- 3. get_my_coaches, get_bookable_sessions and get_pillar_coaches feed the booking page.
-- 4. request_session_time: a family asks for a time that isn't listed. It is a requested
--    booking on a new session offered only to them; it goes away if the coach declines or
--    the request expires.

-- ---------------------------------------------------------------------------
-- Pillars
-- ---------------------------------------------------------------------------

create or replace function public.canonical_pillar(p_title text)
returns text
language sql
immutable
as $$
  select case lower(regexp_replace(trim(coalesce(p_title, '')), '\s+', ' ', 'g'))
    when '' then null
    when 'on field training' then 'On-field training'
    when 'on-field training' then 'On-field training'
    when 'technical' then 'On-field training'
    when 'tactical' then 'On-field training'
    when 'technical training' then 'On-field training'
    when 'tactical training' then 'On-field training'
    when 'fake goalkeeper pillar' then 'On-field training'
    when 'fake shot stopping' then 'On-field training'
    when 'video analysis' then 'Video analysis'
    when 'mentorship' then 'Mentorship'
    when 'strength + conditioning' then 'Performance coaching'
    when 'strength and conditioning' then 'Performance coaching'
    when 'performance training' then 'Performance coaching'
    when 'performance coaching' then 'Performance coaching'
    when 'academic tutoring' then 'Academic tutoring'
    when 'college recruiting' then 'College recruiting'
    when 'technical development' then 'Technical development'
    when 'fake stroke rate' then 'Technical development'
    when 'fake rower pillar' then 'Technical development'
    when 'race preparation' then 'Race preparation'
    else trim(p_title)
  end;
$$;

insert into public.sport_pillars (sport, title, icon, description)
select v.sport::public.sport_type, v.title, v.icon, v.description
from (values
  ('soccer', 'On-field training', 'activity', 'Technical and tactical work on the ball'),
  ('soccer', 'Video analysis', 'video', 'Your game film reviewed clip by clip'),
  ('soccer', 'Mentorship', 'users', 'Mindset, habits and goal setting'),
  ('soccer', 'Performance coaching', 'dumbbell', 'Speed, strength and conditioning'),
  ('soccer', 'Academic tutoring', 'pencil', 'Study support and test prep'),
  ('soccer', 'College recruiting', 'trophy', 'Profiles, film and outreach plans'),
  ('rowing', 'Technical development', 'ship', 'Stroke technique and boat feel'),
  ('rowing', 'Race preparation', 'activity', 'Race plans, pacing and starts'),
  ('rowing', 'Mentorship', 'users', 'Mindset, habits and goal setting'),
  ('rowing', 'Performance coaching', 'dumbbell', 'Speed, strength and conditioning'),
  ('rowing', 'Academic tutoring', 'pencil', 'Study support and test prep'),
  ('rowing', 'College recruiting', 'trophy', 'Profiles, film and outreach plans')
) as v(sport, title, icon, description)
where not exists (
  select 1 from public.sport_pillars as existing
  where existing.sport::text = v.sport and existing.title = v.title
);

-- Point coach links at the real pillar with the canonical title, then drop pillars no longer used.
insert into public.coach_sport_pillars (coach_id, sport_pillar_id, sport)
select distinct link.coach_id, target.id, target.sport
from public.coach_sport_pillars as link
join public.sport_pillars as old on old.id = link.sport_pillar_id
join public.sport_pillars as target
  on target.sport = old.sport and target.title = public.canonical_pillar(old.title)
where target.id <> old.id
  and not exists (
    select 1 from public.coach_sport_pillars as dup
    where dup.coach_id = link.coach_id and dup.sport_pillar_id = target.id
  );

delete from public.coach_sport_pillars as link
using public.sport_pillars as old
where old.id = link.sport_pillar_id and old.title <> public.canonical_pillar(old.title);

delete from public.sport_pillars as old
where old.title <> public.canonical_pillar(old.title)
  and not exists (select 1 from public.coach_sport_pillars as link where link.sport_pillar_id = old.id);

update public.coach_availability_slot_occurrences
  set pillar_slot = public.canonical_pillar(pillar_slot)
  where pillar_slot is distinct from public.canonical_pillar(pillar_slot);
update public.coach_availability_weekly_slots
  set pillar_slot = public.canonical_pillar(pillar_slot)
  where pillar_slot is distinct from public.canonical_pillar(pillar_slot);
update public.coach_session_series
  set pillar_slot = public.canonical_pillar(pillar_slot)
  where pillar_slot is distinct from public.canonical_pillar(pillar_slot);

-- ---------------------------------------------------------------------------
-- Who is booking
-- ---------------------------------------------------------------------------

create or replace function public.current_athlete_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select profile.athlete_id from public.user_profiles as profile where profile.id = auth.uid()),
    (select athlete.id from public.athlete_profiles as athlete where athlete.user_id = auth.uid() order by athlete.created_at limit 1)
  );
$$;

revoke all on function public.current_athlete_id() from public, anon;
grant execute on function public.current_athlete_id() to authenticated;

-- A family already trains with a coach when they have a booked or completed session,
-- or a confirmed referral. Same rule as checkout.
create or replace function public.is_coach_client(p_coach_id uuid, p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_athlete_id is not null and (
    exists (
      select 1 from public.coach_slot_bookings as b
      where b.coach_id = p_coach_id and b.athlete_id = p_athlete_id and b.status in ('booked', 'completed')
    )
    or exists (
      select 1 from public.coach_client_referrals as r
      where r.coach_id = p_coach_id and r.athlete_id = p_athlete_id and r.status = 'confirmed'
    )
  );
$$;

revoke all on function public.is_coach_client(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What a family can book
-- ---------------------------------------------------------------------------

-- Upcoming sessions of p_coach_id that p_athlete_id can see between p_from and p_to:
-- published, enabled, not started, not hidden by a busy time, and open to them
-- (offered sessions only to the athletes they were offered to, clients-only sessions
-- only to the coach's families). Sessions the athlete already holds are included.
create or replace function public.visible_sessions(p_coach_id uuid, p_athlete_id uuid, p_from date, p_to date)
returns table(
  id uuid, coach_id uuid, occurrence_date date, start_time time, end_time time,
  duration_minutes integer, session_type text, session_name text, price numeric,
  capacity integer, location text, place text, pillar text, "position" text,
  visibility text, details jsonb, booked_count integer, my_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select occ.id, occ.coach_id, occ.occurrence_date, occ.start_time, occ.end_time,
    occ.duration_minutes, occ.session_type, occ.session_name, occ.price,
    occ.max_bookings_per_slot, occ.location, occ.place, occ.pillar_slot, occ.position,
    occ.visibility, occ.details,
    (select count(*)::integer from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')),
    (select b.status from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.athlete_id = p_athlete_id
        and b.status in ('requested', 'pending_payment', 'booked', 'completed')
      order by b.created_at desc limit 1)
  from public.coach_availability_slot_occurrences as occ
  where occ.coach_id = p_coach_id
    and occ.occurrence_date between p_from and p_to
    and occ.is_enabled
    and not occ.is_draft
    and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
    and not public.coach_is_busy(occ.coach_id, occ.occurrence_date, occ.start_time, occ.end_time)
    and (
      occ.visibility = 'open'
      or (occ.visibility = 'offered' and p_athlete_id = any(occ.offered_to))
      or (occ.visibility = 'clients' and public.is_coach_client(occ.coach_id, p_athlete_id))
    );
$$;

revoke all on function public.visible_sessions(uuid, uuid, date, date) from public, anon, authenticated;

create or replace function public.coach_credits_left(p_coach_id uuid, p_athlete_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(purchase.sessions_remaining), 0)::integer
  from public.package_purchases as purchase
  join public.athlete_profiles as athlete on athlete.user_id = purchase.user_id
  where purchase.coach_id = p_coach_id
    and athlete.id = p_athlete_id
    and purchase.status = 'active'
    and coalesce(purchase.sessions_remaining, 0) > 0
    and (purchase.expiry_date is null or purchase.expiry_date > now());
$$;

revoke all on function public.coach_credits_left(uuid, uuid) from public, anon, authenticated;

-- Coach card fields shared by the booking RPCs.
create or replace function public.booking_coach_card(p_coach_id uuid, p_athlete_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', coach.id,
    'name', coach.name,
    'slug', coach.slug,
    'image_url', coalesce(coach.profile_image_url, coach.image_url),
    'specialties', coalesce(to_jsonb(coach.specialties), '[]'::jsonb),
    'positions', coalesce(to_jsonb(coach.positions), '[]'::jsonb),
    'hourly_rate', coach.hourly_rate,
    'locations', coalesce(to_jsonb(coach.locations), '[]'::jsonb),
    'rating', coach.rating,
    'total_reviews', coach.total_reviews,
    'is_client', public.is_coach_client(coach.id, p_athlete_id),
    'needs_request', coach.new_family_booking = 'request' and not public.is_coach_client(coach.id, p_athlete_id),
    'credits', public.coach_credits_left(coach.id, p_athlete_id)
  )
  from public.coaches as coach
  where coach.id = p_coach_id;
$$;

revoke all on function public.booking_coach_card(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_my_coaches()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (select public.current_athlete_id() as athlete_id),
  linked as (
    select b.coach_id, max(b.created_at) as last_at
    from public.coach_slot_bookings as b, me
    where b.athlete_id = me.athlete_id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
    group by b.coach_id
    union all
    select r.coach_id, r.confirmed_at
    from public.coach_client_referrals as r, me
    where r.athlete_id = me.athlete_id and r.status = 'confirmed'
    union all
    select purchase.coach_id, purchase.purchase_date
    from public.package_purchases as purchase
    join public.athlete_profiles as athlete on athlete.user_id = purchase.user_id, me
    where athlete.id = me.athlete_id and purchase.status = 'active'
  )
  select coalesce(jsonb_agg(card order by last_at desc nulls last), '[]'::jsonb)
  from (
    select public.booking_coach_card(linked.coach_id, me.athlete_id)
      || jsonb_build_object('next_session', (
        select jsonb_build_object('date', occ.occurrence_date, 'start_time', occ.start_time)
        from public.coach_slot_bookings as b
        join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
        where b.coach_id = linked.coach_id and b.athlete_id = me.athlete_id
          and b.status in ('pending_payment', 'booked')
          and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
        order by occ.occurrence_date, occ.start_time limit 1
      )) as card,
      max(linked.last_at) as last_at
    from linked, me
    join public.coaches as coach on true
    where coach.id = linked.coach_id and coalesce(coach.status, 'active') = 'active'
    group by linked.coach_id, me.athlete_id
  ) as cards;
$$;

revoke all on function public.get_my_coaches() from public, anon;
grant execute on function public.get_my_coaches() to authenticated;

-- One coach's bookable sessions for p_from..p_to (Eastern dates, up to 35 days), plus the
-- coach card. Works signed out too (only open sessions then).
create or replace function public.get_bookable_sessions(p_coach_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_athlete uuid := public.current_athlete_id();
begin
  if p_to < p_from or p_to - p_from > 35 then
    raise exception 'Pick a range of up to 35 days' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'coach', public.booking_coach_card(p_coach_id, v_athlete),
    'sessions', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.occurrence_date, s.start_time)
      from public.visible_sessions(p_coach_id, v_athlete, p_from, p_to) as s
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_bookable_sessions(uuid, date, date) to anon, authenticated;

-- Soccer coaches for a pillar and position (null = any), with their next open 1-on-1 and
-- next group with space in the next four weeks. A coach offers a pillar when it's on their
-- profile or on one of their upcoming sessions.
create or replace function public.get_pillar_coaches(p_pillar text, p_position text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (select public.current_athlete_id() as athlete_id),
  today as (select (timezone('America/New_York', now()))::date as d),
  candidates as (
    select coach.id
    from public.coaches as coach
    where coalesce(coach.status, 'active') = 'active'
      and (
        exists (
          select 1 from public.coach_sport_pillars as link
          join public.sport_pillars as pillar on pillar.id = link.sport_pillar_id
          where link.coach_id = coach.id and pillar.sport = 'soccer' and pillar.title = public.canonical_pillar(p_pillar)
        )
        or exists (
          select 1 from public.coach_availability_slot_occurrences as occ, today
          where occ.coach_id = coach.id and occ.is_enabled and not occ.is_draft
            and occ.pillar_slot = public.canonical_pillar(p_pillar)
            and occ.occurrence_date between today.d and today.d + 28
        )
      )
      and (
        p_position is null
        or (p_position = 'Goalkeeper' and exists (
          select 1 from unnest(coalesce(coach.positions, '{}') || coalesce(coach.favourite_positions, '{}') || array[coalesce(coach.position, '')]) as pos
          where pos ilike '%keeper%'
        ))
        or (p_position = 'Field player' and (
          coalesce(array_length(coach.positions, 1), 0) = 0
          or exists (
            select 1 from unnest(coalesce(coach.positions, '{}') || coalesce(coach.favourite_positions, '{}')) as pos
            where pos <> '' and pos not ilike '%keeper%' and pos not ilike '%rower%' and pos not ilike '%coxswain%'
          )
        ))
      )
  ),
  sessions as (
    select s.*
    from candidates, me, today,
      lateral public.visible_sessions(candidates.id, me.athlete_id, today.d, today.d + 28) as s
    where s.my_status is null
      and (p_position is null or s.position is null or s.position in (p_position, 'Both'))
  )
  select coalesce(jsonb_agg(card order by (card->>'is_client')::boolean desc, (card->>'rating')::numeric desc nulls last, card->>'name'), '[]'::jsonb)
  from (
    select public.booking_coach_card(candidates.id, me.athlete_id) || jsonb_build_object(
      'next_open', (
        select jsonb_build_object('date', s.occurrence_date, 'start_time', s.start_time)
        from sessions as s
        where s.coach_id = candidates.id and s.session_type = 'individual' and s.booked_count = 0
        order by s.occurrence_date, s.start_time limit 1
      ),
      'next_group', (
        select jsonb_build_object('date', s.occurrence_date, 'start_time', s.start_time,
          'spots_left', s.capacity - s.booked_count, 'capacity', s.capacity, 'name', s.session_name)
        from sessions as s
        where s.coach_id = candidates.id and s.session_type = 'group' and s.booked_count < s.capacity
          and (s.pillar is null or s.pillar = public.canonical_pillar(p_pillar))
        order by s.occurrence_date, s.start_time limit 1
      ),
      'group_from', (
        select min(s.price) from sessions as s
        where s.coach_id = candidates.id and s.session_type = 'group' and s.booked_count < s.capacity
      ),
      'one_on_one_from', (
        select min(s.price) from sessions as s
        where s.coach_id = candidates.id and s.session_type = 'individual' and s.booked_count = 0
      )
    ) as card
    from candidates, me
  ) as cards;
$$;

grant execute on function public.get_pillar_coaches(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Request a time that isn't listed
-- ---------------------------------------------------------------------------

create or replace function public.request_session_time(
  p_coach_id uuid,
  p_date date,
  p_start time,
  p_note text default null,
  p_pillar text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete uuid := public.current_athlete_id();
  v_coach public.coaches;
  v_end time := p_start + interval '60 minutes';
  v_occ_id uuid;
  v_booking_id uuid;
begin
  if v_athlete is null then
    raise exception 'Sign in as an athlete or parent to request a time' using errcode = '42501';
  end if;
  select * into v_coach from public.coaches where id = p_coach_id and coalesce(status, 'active') = 'active';
  if v_coach.id is null then
    raise exception 'Coach not found' using errcode = '42501';
  end if;
  if public.eastern_timestamp(p_date, p_start) <= now() + interval '1 hour' then
    raise exception 'Pick a time at least an hour from now' using errcode = '22023';
  end if;
  if p_start > '23:00'::time then
    raise exception 'Pick a time before 11 PM' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.coach_slot_bookings as b
    join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
    where b.athlete_id = v_athlete and b.coach_id = p_coach_id and b.status = 'requested'
      and occ.details ? 'requested_time'
  ) then
    raise exception 'You already asked this coach for a time. Wait for their answer first.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.coach_availability_slot_occurrences as other
    where other.coach_id = p_coach_id and other.is_enabled and other.occurrence_date = p_date
      and other.start_time < v_end and p_start < other.end_time
  ) or public.coach_is_busy(p_coach_id, p_date, p_start, v_end) then
    raise exception 'The coach already has something at that time. Try another time.' using errcode = '22023';
  end if;
  if coalesce(v_coach.hourly_rate, 0) <= 0 then
    raise exception 'This coach hasn''t set a price yet. Message them instead.' using errcode = '22023';
  end if;

  insert into public.coach_availability_slot_occurrences (
    coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
    session_type, location, place, pillar_slot, visibility, offered_to, details, is_enabled,
    max_bookings_per_slot
  ) values (
    p_coach_id, p_date, '1-on-1 session', v_coach.hourly_rate, 60, p_start, v_end,
    'individual', 'in-person', v_coach.locations[1], public.canonical_pillar(p_pillar), 'offered',
    array[v_athlete], jsonb_build_object('requested_time', true), true, 1
  ) returning id into v_occ_id;

  insert into public.coach_slot_bookings (occurrence_id, coach_id, athlete_id, status, payment_status, notes, created_by)
    values (v_occ_id, p_coach_id, v_athlete, 'requested', 'unpaid', nullif(left(trim(coalesce(p_note, '')), 500), ''), auth.uid())
    returning id into v_booking_id;
  return v_booking_id;
end;
$$;

revoke all on function public.request_session_time(uuid, date, time, text, text) from public, anon;
grant execute on function public.request_session_time(uuid, date, time, text, text) to authenticated;

-- A requested time that is declined or expires takes its session away with it.
create or replace function public.close_requested_time()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'canceled' and old.status is distinct from 'canceled' then
    update public.coach_availability_slot_occurrences
      set is_enabled = false, disabled_reason = 'removed'
      where id = new.occurrence_id and details ? 'requested_time' and is_enabled;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bookings_close_requested_time on public.coach_slot_bookings;
create trigger trg_bookings_close_requested_time
  after update of status on public.coach_slot_bookings
  for each row execute function public.close_requested_time();
