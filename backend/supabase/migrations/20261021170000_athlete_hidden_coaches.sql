-- Family Home "Coaches" card: who shows, and letting a family remove a coach.
--
-- 1. Who shows: a coach shows once the athlete has a confirmed session with them (booked,
--    completed or marked missed), a package with them (not revoked) or an accepted invite
--    (confirmed coach_client_referrals). A pending request, an unpaid offer (pending_payment),
--    a cancelled session or an intro call on its own doesn't count. Intro calls live in
--    coach_intro_calls, not in coach_slot_bookings, so they never counted here.
-- 2. athlete_hidden_coaches: coaches a family removed from "My coaches". Past sessions and
--    messages stay. hide_coach / unhide_coach (Undo) write it; RLS lets a user see and change
--    only their own rows.
-- 3. Booking that coach again (a booking becomes booked) or buying one of their packages
--    un-hides the coach automatically.
-- 4. get_athlete_home and get_my_coaches (the Book page's "Your coaches") leave hidden coaches
--    out. Both are copied from the live definitions; only the coach filter changed.
-- Safe to run more than once.

create table if not exists public.athlete_hidden_coaches (
  user_id uuid not null references auth.users(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, coach_id)
);

alter table public.athlete_hidden_coaches enable row level security;

drop policy if exists "Users read their hidden coaches" on public.athlete_hidden_coaches;
create policy "Users read their hidden coaches" on public.athlete_hidden_coaches
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users hide coaches for themselves" on public.athlete_hidden_coaches;
create policy "Users hide coaches for themselves" on public.athlete_hidden_coaches
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users un-hide their coaches" on public.athlete_hidden_coaches;
create policy "Users un-hide their coaches" on public.athlete_hidden_coaches
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.athlete_hidden_coaches from anon;
grant select, insert, delete on public.athlete_hidden_coaches to authenticated;

-- The coaches that count as the athlete's coaches (before hiding).
create or replace function public.athlete_coach_ids(p_athlete_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select booking.coach_id
  from public.coach_slot_bookings as booking
  where booking.athlete_id = p_athlete_id
    and booking.status in ('booked', 'completed', 'no_show')
  union
  select referral.coach_id
  from public.coach_client_referrals as referral
  where referral.athlete_id = p_athlete_id
    and referral.status = 'confirmed'
  union
  select purchase.coach_id
  from public.package_purchases as purchase
  join public.athlete_profiles as athlete on athlete.user_id = purchase.user_id
  where athlete.id = p_athlete_id
    and purchase.coach_id is not null
    and purchase.source = 'package'
    and purchase.revoked_at is null;
$$;

revoke all on function public.athlete_coach_ids(uuid) from public, anon, authenticated;

create or replace function public.hide_coach(p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if p_coach_id is null or not exists (select 1 from public.coaches where id = p_coach_id) then
    raise exception 'Coach not found' using errcode = '22023';
  end if;
  insert into public.athlete_hidden_coaches (user_id, coach_id)
  values (auth.uid(), p_coach_id)
  on conflict (user_id, coach_id) do update set hidden_at = now();
end;
$$;

create or replace function public.unhide_coach(p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  delete from public.athlete_hidden_coaches where user_id = auth.uid() and coach_id = p_coach_id;
end;
$$;

revoke all on function public.hide_coach(uuid) from public, anon;
revoke all on function public.unhide_coach(uuid) from public, anon;
grant execute on function public.hide_coach(uuid) to authenticated;
grant execute on function public.unhide_coach(uuid) to authenticated;

-- Booking a hidden coach again brings them back. Never blocks the booking itself.
create or replace function public.unhide_coach_on_booking()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'booked' and (tg_op = 'INSERT' or old.status is distinct from 'booked') then
    begin
      delete from public.athlete_hidden_coaches as hidden
      where hidden.coach_id = new.coach_id
        and hidden.user_id in (
          select profile.id from public.user_profiles as profile where profile.athlete_id = new.athlete_id
          union
          select athlete.user_id from public.athlete_profiles as athlete where athlete.id = new.athlete_id
          union
          select new.created_by
        );
    exception when others then
      raise warning 'unhide_coach_on_booking: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bookings_unhide_coach on public.coach_slot_bookings;
create trigger trg_bookings_unhide_coach
  after insert or update of status on public.coach_slot_bookings
  for each row execute function public.unhide_coach_on_booking();

create or replace function public.unhide_coach_on_package()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.coach_id is not null and new.user_id is not null and new.source = 'package' then
    begin
      delete from public.athlete_hidden_coaches as hidden
      where hidden.coach_id = new.coach_id
        and hidden.user_id in (
          select new.user_id
          union
          select profile.id from public.user_profiles as profile
          join public.athlete_profiles as athlete on athlete.id = profile.athlete_id
          where athlete.user_id = new.user_id
        );
    exception when others then
      raise warning 'unhide_coach_on_package: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_package_purchases_unhide_coach on public.package_purchases;
create trigger trg_package_purchases_unhide_coach
  after insert on public.package_purchases
  for each row execute function public.unhide_coach_on_package();

revoke all on function public.unhide_coach_on_booking() from public, anon, authenticated;
revoke all on function public.unhide_coach_on_package() from public, anon, authenticated;

-- get_athlete_home: live definition; the coaches filter now uses athlete_coach_ids and hiding.
CREATE OR REPLACE FUNCTION public.get_athlete_home()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_athlete uuid := public.current_athlete_id();
  v_next record;
begin
  if v_athlete is null then
    return null;
  end if;

  select occ.id, occ.occurrence_date, occ.start_time, occ.end_time, occ.session_type, occ.session_name,
         occ.pillar_slot, coalesce(occ.place, occ.location) as place, coach.name as coach_name, booking.status
    into v_next
  from public.coach_slot_bookings as booking
  join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
  join public.coaches as coach on coach.id = booking.coach_id
  where booking.athlete_id = v_athlete
    and booking.status in ('requested', 'pending_payment', 'booked')
    and public.eastern_timestamp(occ.occurrence_date, occ.end_time) > now()
  order by occ.occurrence_date, occ.start_time
  limit 1;

  return jsonb_build_object(
    'athlete', (
      select jsonb_build_object(
        'id', a.id,
        'full_name', a.full_name,
        'date_of_birth', a.date_of_birth,
        'sport', a.sport,
        'position', a.position,
        'team', nullif(a.high_school, ''),
        'graduation_year', a.graduation_year,
        'pathway', a.pathway_tags[1],
        'season_goal', a.season_goal,
        'highlight_video_url', a.highlight_video_url,
        'photo', a.profile_image_url
      )
      from public.athlete_profiles as a where a.id = v_athlete
    ),
    'next', case when v_next.id is null then null else jsonb_build_object(
      'id', v_next.id,
      'date', v_next.occurrence_date,
      'start_time', v_next.start_time,
      'end_time', v_next.end_time,
      'title', case when v_next.session_type = 'group' then coalesce(v_next.session_name, 'Group session')
                    else coalesce(v_next.pillar_slot, '1-on-1') end,
      'place', v_next.place,
      'coach_name', v_next.coach_name,
      'status', v_next.status
    ) end,
    -- What they're working on: the latest note or summary a coach shared after a session they came to.
    'focus', (
      select jsonb_build_object(
        'text', coalesce(nullif(note.feedback_to_athlete, ''), feedback.summary),
        'coach_name', coach.name,
        'date', occ.occurrence_date
      )
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
      join public.coaches as coach on coach.id = booking.coach_id
      left join public.session_feedback_v2 as feedback on feedback.slot_id = occ.id and not feedback.no_show
      left join public.slot_feedback_v2 as note on note.booking_id = booking.id
      left join public.slot_attendance_v2 as attendance on attendance.booking_id = booking.id
      where booking.athlete_id = v_athlete
        and coalesce(attendance.attendance::text, 'present') = 'present'
        and coalesce(nullif(note.feedback_to_athlete, ''), feedback.summary) is not null
      order by occ.occurrence_date desc, occ.start_time desc
      limit 1
    ),
    'coaches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', coach.id,
        'name', coach.name,
        'slug', coach.slug,
        'photo', coalesce(coach.profile_image_url, coach.image_url),
        'next_date', (
          select min(occ.occurrence_date)
          from public.coach_slot_bookings as b
          join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
          where b.athlete_id = v_athlete and b.coach_id = coach.id
            and b.status in ('requested', 'pending_payment', 'booked')
            and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
        ),
        'credits_left', public.coach_credits_left(coach.id, v_athlete)
      ) order by coach.name)
      from public.coaches as coach
      where coach.id in (select public.athlete_coach_ids(v_athlete))
        and coach.id not in (
          select hidden.coach_id from public.athlete_hidden_coaches as hidden where hidden.user_id = auth.uid()
        )
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_athlete_home() from public, anon;
grant execute on function public.get_athlete_home() to authenticated;

-- get_my_coaches: live definition; hidden coaches are left out of "Your coaches" on Book.
-- A hidden coach can still be booked from their profile or Book by pillar.
CREATE OR REPLACE FUNCTION public.get_my_coaches()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and coach.id not in (
        select hidden.coach_id from public.athlete_hidden_coaches as hidden where hidden.user_id = auth.uid()
      )
    group by linked.coach_id, me.athlete_id
  ) as cards;
$function$;

revoke all on function public.get_my_coaches() from public, anon;
grant execute on function public.get_my_coaches() to authenticated;
