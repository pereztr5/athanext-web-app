-- Free intro calls (Working Copy 2).
-- Coaches switch on a short free call so families can meet them before they book. Families
-- pick a time from the coach profile; after the call the coach sends a first-session offer or
-- closes it as not a fit. Both go to the family as a direct message.
--
-- 1. coaches gains the intro call settings: on/off, length (10, 15 or 20 min), video or phone,
--    only new families, a weekly limit, up to 2 questions families answer, and an optional
--    meeting link. The app has no video calling of its own, so Join opens that link.
-- 2. coach_intro_calls holds each booked call. No direct table access; everything goes through
--    the functions below.
-- 3. Intro times come from the coach's open 1-on-1 slots, so a family only sees times the coach
--    already said they're free: from tomorrow through 13 days ahead, the first 2 open slots of
--    each day (enabled, published, open to everyone, not booked or requested, not hidden by a
--    calendar busy time). Each slot offers its start and one call length later, when both fit
--    in the slot. Times that overlap another intro call, or fall in a week that already has the
--    weekly limit, drop out. The first 4 days with a time are shown.
--    The slot stays open for paid bookings: the coach sees the intro call on Home.
-- All dates are Eastern, like the rest of the scheduling code.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

alter table public.coaches
  add column if not exists intro_enabled boolean not null default false,
  add column if not exists intro_minutes integer not null default 15,
  add column if not exists intro_format text not null default 'video',
  add column if not exists intro_new_only boolean not null default true,
  add column if not exists intro_weekly_limit integer not null default 3,
  add column if not exists intro_questions text[] not null
    default array['Athlete''s age and team', 'What would you like to work on?'],
  add column if not exists intro_video_url text;

alter table public.coaches drop constraint if exists coaches_intro_minutes_check;
alter table public.coaches
  add constraint coaches_intro_minutes_check check (intro_minutes in (10, 15, 20));
alter table public.coaches drop constraint if exists coaches_intro_format_check;
alter table public.coaches
  add constraint coaches_intro_format_check check (intro_format in ('video', 'phone'));
alter table public.coaches drop constraint if exists coaches_intro_weekly_limit_check;
alter table public.coaches
  add constraint coaches_intro_weekly_limit_check check (intro_weekly_limit between 1 and 10);
alter table public.coaches drop constraint if exists coaches_intro_questions_check;
alter table public.coaches
  add constraint coaches_intro_questions_check check (coalesce(array_length(intro_questions, 1), 0) <= 2);
alter table public.coaches drop constraint if exists coaches_intro_video_url_check;
alter table public.coaches
  add constraint coaches_intro_video_url_check
  check (intro_video_url is null or (char_length(intro_video_url) <= 500 and intro_video_url ~* '^https://'));

comment on column public.coaches.intro_enabled is 'Free intro call is on: shows on the profile and in Browse.';
comment on column public.coaches.intro_minutes is 'Intro call length: 10, 15 or 20 minutes.';
comment on column public.coaches.intro_format is 'video = Join opens intro_video_url; phone = the coach calls the family.';
comment on column public.coaches.intro_new_only is 'Families who already train with the coach don''t see the intro call.';
comment on column public.coaches.intro_weekly_limit is 'Most intro calls booked in one Monday to Sunday week.';
comment on column public.coaches.intro_questions is 'Up to 2 questions families answer when they book.';
comment on column public.coaches.intro_video_url is 'Meeting link for intro video calls (the app has no video calling of its own).';

-- ---------------------------------------------------------------------------
-- Calls
-- ---------------------------------------------------------------------------

create table if not exists public.coach_intro_calls (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  athlete_id uuid references public.athlete_profiles(id) on delete set null,
  family_user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  minutes integer not null check (minutes between 5 and 60),
  format text not null default 'video' check (format in ('video', 'phone')),
  -- [{ "q": question, "a": answer }] in the order the coach asked them.
  answers jsonb not null default '[]'::jsonb,
  status text not null default 'booked'
    check (status in ('booked', 'done', 'offer_sent', 'not_a_fit', 'cancelled')),
  -- { "key", "label", "expiresAt" } of the first-session offer.
  offer jsonb,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists coach_intro_calls_coach_idx on public.coach_intro_calls (coach_id, starts_at);
-- One intro call per family per coach.
create unique index if not exists coach_intro_calls_family_key
  on public.coach_intro_calls (coach_id, family_user_id)
  where status <> 'cancelled';

alter table public.coach_intro_calls enable row level security;
revoke all on table public.coach_intro_calls from anon, authenticated;

comment on table public.coach_intro_calls is
  'Free intro calls families booked with a coach. Read and written only through the intro call functions.';

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

-- Intro call start times a family can pick for p_coach_id (see 3. above).
create or replace function public.intro_open_times(p_coach_id uuid)
returns table(starts_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with coach as (
    select id, intro_minutes as mins, intro_weekly_limit as cap
    from public.coaches
    where id = p_coach_id and intro_enabled
  ),
  slots as (
    select occ.occurrence_date as day, occ.start_time, occ.end_time,
      row_number() over (partition by occ.occurrence_date order by occ.start_time) as n
    from public.coach_availability_slot_occurrences as occ
    where occ.coach_id = p_coach_id
      and occ.session_type = 'individual'
      and occ.is_enabled
      and not occ.is_draft
      and occ.visibility = 'open'
      and occ.occurrence_date between (now() at time zone 'America/New_York')::date + 1
                                  and (now() at time zone 'America/New_York')::date + 13
      and not public.coach_is_busy(occ.coach_id, occ.occurrence_date, occ.start_time, occ.end_time)
      and not exists (
        select 1 from public.coach_slot_bookings as booking
        where booking.occurrence_id = occ.id
          and booking.status in ('requested', 'pending_payment', 'booked', 'completed')
      )
  ),
  candidates as (
    select slots.day,
      public.eastern_timestamp(slots.day, slots.start_time) + make_interval(mins => k * coach.mins) as starts_at,
      coach.mins, coach.cap
    from slots
    cross join coach
    cross join generate_series(0, 1) as k
    where slots.n <= 2
      and extract(epoch from slots.start_time) / 60 + (k + 1) * coach.mins <= extract(epoch from slots.end_time) / 60
  ),
  free as (
    select c.day, c.starts_at
    from candidates as c
    where c.starts_at > now()
      and not exists (
        select 1 from public.coach_intro_calls as call
        where call.coach_id = p_coach_id and call.status <> 'cancelled'
          and call.starts_at < c.starts_at + make_interval(mins => c.mins)
          and c.starts_at < call.starts_at + make_interval(mins => call.minutes)
      )
      and (
        select count(*) from public.coach_intro_calls as call
        where call.coach_id = p_coach_id and call.status <> 'cancelled'
          and date_trunc('week', call.starts_at at time zone 'America/New_York')
            = date_trunc('week', c.starts_at at time zone 'America/New_York')
      ) < c.cap
  )
  select ranked.starts_at
  from (select free.starts_at, dense_rank() over (order by free.day) as day_rank from free) as ranked
  where ranked.day_rank <= 4
  order by ranked.starts_at;
$$;

revoke all on function public.intro_open_times(uuid) from public, anon, authenticated;

-- First-session offers a coach can send: the 1-on-1 price, then active packages by price.
-- The package families bought most is marked "most booked".
create or replace function public.intro_offer_options(p_coach_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with packages as (
    select package.id, package.package_name, package.total_price, package.display_order,
      (select count(*) from public.package_purchases as purchase where purchase.package_id = package.id) as bought
    from public.coach_packages as package
    where package.coach_id = p_coach_id and package.is_active
  ),
  top as (
    select id from packages where bought > 0 order by bought desc, total_price limit 1
  )
  select coalesce(jsonb_agg(option order by sort), '[]'::jsonb)
  from (
    select 0 as sort, jsonb_build_object(
      'key', 's:individual',
      'label', '1-on-1 session · 60 min · $' || to_char(coach.hourly_rate, 'FM999,990')
    ) as option
    from public.coaches as coach
    where coach.id = p_coach_id and coalesce(coach.hourly_rate, 0) > 0
    union all
    select 1 + row_number() over (order by packages.total_price, packages.display_order nulls last), jsonb_build_object(
      'key', 'p:' || packages.id,
      'label', packages.package_name || ' · $' || to_char(round(packages.total_price / 100.0), 'FM999,990')
        || case when packages.id in (select id from top) then ' · most booked' else '' end
    )
    from packages
  ) as options;
$$;

revoke all on function public.intro_offer_options(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Coach settings
-- ---------------------------------------------------------------------------

create or replace function public.get_my_intro_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null then
    raise exception 'Only coaches have intro call settings' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'enabled', coach.intro_enabled,
      'minutes', coach.intro_minutes,
      'format', coach.intro_format,
      'newOnly', coach.intro_new_only,
      'weeklyLimit', coach.intro_weekly_limit,
      'questions', to_jsonb(coach.intro_questions),
      'videoUrl', coach.intro_video_url,
      'bookedThisWeek', (
        select count(*) from public.coach_intro_calls as call
        where call.coach_id = v_coach and call.status <> 'cancelled'
          and date_trunc('week', call.starts_at at time zone 'America/New_York')
            = date_trunc('week', now() at time zone 'America/New_York')
      )
    )
    from public.coaches as coach
    where coach.id = v_coach
  );
end;
$$;

revoke all on function public.get_my_intro_settings() from public, anon;
grant execute on function public.get_my_intro_settings() to authenticated;

create or replace function public.save_my_intro_settings(p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_minutes integer := coalesce((p_settings->>'minutes')::integer, 15);
  v_format text := coalesce(p_settings->>'format', 'video');
  v_limit integer := coalesce((p_settings->>'weeklyLimit')::integer, 3);
  v_url text := nullif(trim(coalesce(p_settings->>'videoUrl', '')), '');
  v_questions text[];
begin
  if v_coach is null then
    raise exception 'Only coaches have intro call settings' using errcode = '42501';
  end if;
  if v_minutes not in (10, 15, 20) then
    raise exception 'Pick 10, 15 or 20 minutes' using errcode = '22023';
  end if;
  if v_format not in ('video', 'phone') then
    raise exception 'Pick a video or phone call' using errcode = '22023';
  end if;
  if v_limit not between 1 and 10 then
    raise exception 'Pick a weekly limit from 1 to 10' using errcode = '22023';
  end if;
  if v_url is not null and (v_url !~* '^https://' or char_length(v_url) > 500) then
    raise exception 'Use a meeting link that starts with https://' using errcode = '22023';
  end if;

  select coalesce(array_agg(q order by ord), '{}') into v_questions
  from (
    select trim(value) as q, ord
    from jsonb_array_elements_text(coalesce(p_settings->'questions', '[]'::jsonb)) with ordinality as item(value, ord)
  ) as questions
  where q <> '';
  if coalesce(array_length(v_questions, 1), 0) > 2 then
    raise exception 'Ask up to 2 questions' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_questions) as q where char_length(q) > 200) then
    raise exception 'Keep each question under 200 characters' using errcode = '22023';
  end if;

  update public.coaches set
    intro_enabled = coalesce((p_settings->>'enabled')::boolean, false),
    intro_minutes = v_minutes,
    intro_format = v_format,
    intro_new_only = coalesce((p_settings->>'newOnly')::boolean, true),
    intro_weekly_limit = v_limit,
    intro_questions = v_questions,
    intro_video_url = v_url
  where id = v_coach;
end;
$$;

revoke all on function public.save_my_intro_settings(jsonb) from public, anon;
grant execute on function public.save_my_intro_settings(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Families: Browse, the coach profile and booking
-- ---------------------------------------------------------------------------

-- Coaches with intro calls on, for the Browse pill.
create or replace function public.intro_enabled_coach_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.coaches where intro_enabled;
$$;

revoke all on function public.intro_enabled_coach_ids() from public;
grant execute on function public.intro_enabled_coach_ids() to anon, authenticated;

-- What the profile card and booking sheet need for p_coach_id and the signed-in family.
-- canBook is false with a reason: signin, own (the coach's own profile), noAthlete, client
-- (already trains with the coach and the coach only takes new families) or booked.
create or replace function public.get_coach_intro(p_coach_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_athlete uuid := public.current_athlete_id();
  v_coach public.coaches;
  v_call public.coach_intro_calls;
  v_reason text;
begin
  select * into v_coach from public.coaches where id = p_coach_id;
  if v_coach.id is null or not v_coach.intro_enabled then
    return jsonb_build_object('enabled', false);
  end if;

  if v_me is not null then
    select * into v_call from public.coach_intro_calls
    where coach_id = p_coach_id and family_user_id = v_me and status <> 'cancelled'
    order by created_at desc
    limit 1;
  end if;

  v_reason := case
    when v_me is null then 'signin'
    when public.current_coach_id() = p_coach_id then 'own'
    when v_call.id is not null then 'booked'
    when v_athlete is null then 'noAthlete'
    when v_coach.intro_new_only and public.is_coach_client(p_coach_id, v_athlete) then 'client'
  end;

  return jsonb_build_object(
    'enabled', true,
    'minutes', v_coach.intro_minutes,
    'format', v_coach.intro_format,
    'questions', to_jsonb(v_coach.intro_questions),
    'canBook', v_reason is null,
    'reason', v_reason,
    'athlete', (
      select jsonb_build_object('id', athlete.id, 'name', athlete.full_name, 'birthDate', athlete.date_of_birth)
      from public.athlete_profiles as athlete
      where athlete.id = v_athlete and v_me is not null
    ),
    'booked', case when v_call.id is null then null else jsonb_build_object(
      'id', v_call.id,
      'startsAt', v_call.starts_at,
      'minutes', v_call.minutes,
      'status', v_call.status,
      'videoUrl', case when v_call.format = 'video' and v_call.status = 'booked' then v_coach.intro_video_url end
    ) end,
    'times', case when v_reason is null then coalesce(
      (select jsonb_agg(t.starts_at order by t.starts_at) from public.intro_open_times(p_coach_id) as t),
      '[]'::jsonb
    ) else '[]'::jsonb end
  );
end;
$$;

revoke all on function public.get_coach_intro(uuid) from public;
grant execute on function public.get_coach_intro(uuid) to anon, authenticated;

-- Books an intro call for the signed-in family's current athlete. p_answers is a JSON array of
-- answers in the order of the coach's questions. Tells the coach in their direct conversation.
create or replace function public.book_intro_call(p_coach_id uuid, p_starts_at timestamptz, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_athlete uuid := public.current_athlete_id();
  v_coach public.coaches;
  v_coach_user uuid;
  v_name text;
  v_answers jsonb;
  v_id uuid;
  v_body text;
  v_conversation_id uuid;
begin
  if v_me is null then
    raise exception 'Sign in to book an intro call' using errcode = '42501';
  end if;
  -- One booking at a time per coach, so two families can't take the same time.
  perform pg_advisory_xact_lock(hashtext('intro:' || p_coach_id::text));

  select * into v_coach from public.coaches where id = p_coach_id;
  if v_coach.id is null or not v_coach.intro_enabled then
    raise exception 'This coach isn''t taking intro calls right now' using errcode = '22023';
  end if;
  if public.current_coach_id() = p_coach_id then
    raise exception 'You can''t book your own intro call' using errcode = '22023';
  end if;
  if v_athlete is null then
    raise exception 'Add your athlete before booking' using errcode = '22023';
  end if;
  if v_coach.intro_new_only and public.is_coach_client(p_coach_id, v_athlete) then
    raise exception 'Intro calls are for families new to this coach' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.coach_intro_calls
    where coach_id = p_coach_id and family_user_id = v_me and status <> 'cancelled'
  ) then
    raise exception 'You already have an intro call with this coach' using errcode = '22023';
  end if;
  if not exists (select 1 from public.intro_open_times(p_coach_id) as t where t.starts_at = p_starts_at) then
    raise exception 'That time was just taken. Pick another one.' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('q', q.question, 'a', left(trim(coalesce(p_answers->>(q.ord::integer - 1), '')), 500)) order by q.ord), '[]'::jsonb)
    into v_answers
  from unnest(v_coach.intro_questions) with ordinality as q(question, ord);

  insert into public.coach_intro_calls (coach_id, athlete_id, family_user_id, starts_at, minutes, format, answers)
  values (p_coach_id, v_athlete, v_me, p_starts_at, v_coach.intro_minutes, v_coach.intro_format, v_answers)
  returning id into v_id;

  -- Message the coach from the family, which also lights up their notifications.
  select profile.id into v_coach_user from public.user_profiles as profile where profile.coach_id = p_coach_id limit 1;
  if v_coach_user is not null and v_coach_user <> v_me then
    select full_name into v_name from public.athlete_profiles where id = v_athlete;
    v_body := 'Booked a free ' || v_coach.intro_minutes || '-min intro call for ' || split_part(coalesce(v_name, 'my athlete'), ' ', 1)
      || ', ' || to_char(p_starts_at at time zone 'America/New_York', 'FMDay, Mon FMDD "at" FMHH12:MI am') || ' (Eastern).'
      || coalesce((
        select ' ' || string_agg(item->>'a', ' · ' order by ord)
        from jsonb_array_elements(v_answers) with ordinality as a(item, ord)
        where coalesce(item->>'a', '') <> ''
      ), '');
    select conversation.id into v_conversation_id
    from public.conversations as conversation
    where not coalesce(conversation.is_group, false) and conversation.owner_coach_id is null
      and exists (select 1 from public.conversation_participants p where p.conversation_id = conversation.id and p.user_id = v_me)
      and exists (select 1 from public.conversation_participants p where p.conversation_id = conversation.id and p.user_id = v_coach_user)
    order by conversation.last_message_at desc nulls last
    limit 1;
    if v_conversation_id is null then
      insert into public.conversations (created_by, is_group, title) values (v_me, false, v_coach.name)
        returning id into v_conversation_id;
      insert into public.conversation_participants (conversation_id, user_id, role)
        values (v_conversation_id, v_me, 'owner'), (v_conversation_id, v_coach_user, 'member');
    end if;
    insert into public.messages (conversation_id, sender_id, body) values (v_conversation_id, v_me, v_body);
    update public.conversations set last_message_at = now(), last_message_text = left(v_body, 200) where id = v_conversation_id;
  end if;

  return jsonb_build_object('id', v_id, 'startsAt', p_starts_at, 'minutes', v_coach.intro_minutes);
end;
$$;

revoke all on function public.book_intro_call(uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.book_intro_call(uuid, timestamptz, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Coach Home: calls today and after the call
-- ---------------------------------------------------------------------------

-- Booked calls from the last 30 days on (the app splits them into today and follow-ups),
-- this week's count, the meeting link and the offers the coach can send.
create or replace function public.get_coach_intro_calls()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null then
    raise exception 'Only coaches have intro calls' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'weeklyLimit', (select intro_weekly_limit from public.coaches where id = v_coach),
    'videoUrl', (select intro_video_url from public.coaches where id = v_coach),
    'bookedThisWeek', (
      select count(*) from public.coach_intro_calls as call
      where call.coach_id = v_coach and call.status <> 'cancelled'
        and date_trunc('week', call.starts_at at time zone 'America/New_York')
          = date_trunc('week', now() at time zone 'America/New_York')
    ),
    'options', public.intro_offer_options(v_coach),
    'calls', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', call.id,
        'startsAt', call.starts_at,
        'minutes', call.minutes,
        'format', call.format,
        'answers', call.answers,
        'athleteId', call.athlete_id,
        'athleteName', athlete.full_name,
        'athleteBirthDate', athlete.date_of_birth,
        'familyName', coalesce(nullif(trim(family.name), ''), athlete.full_name, 'A family'),
        'phone', case when call.format = 'phone' then coalesce(family.phone_number, athlete.phone_number) end
      ) order by call.starts_at)
      from public.coach_intro_calls as call
      left join public.athlete_profiles as athlete on athlete.id = call.athlete_id
      left join public.user_profiles as family on family.id = call.family_user_id
      where call.coach_id = v_coach
        and call.status = 'booked'
        and call.starts_at > now() - interval '30 days'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_coach_intro_calls() from public, anon;
grant execute on function public.get_coach_intro_calls() to authenticated;

-- Sends the picked first-session offer to the family and closes the call.
create or replace function public.send_intro_offer(p_call_id uuid, p_option_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_call public.coach_intro_calls;
  v_label text;
  v_name text;
begin
  select * into v_call from public.coach_intro_calls where id = p_call_id and coach_id = v_coach for update;
  if v_call.id is null then
    raise exception 'Intro call not found' using errcode = '42501';
  end if;
  if v_call.status <> 'booked' then
    raise exception 'This intro call was already followed up' using errcode = '22023';
  end if;
  if v_call.starts_at > now() then
    raise exception 'Send the offer after the call' using errcode = '22023';
  end if;
  select option->>'label' into v_label
  from jsonb_array_elements(public.intro_offer_options(v_coach)) as option
  where option->>'key' = p_option_key;
  if v_label is null then
    raise exception 'Pick one of your sessions or packages' using errcode = '22023';
  end if;

  update public.coach_intro_calls
    set status = 'offer_sent', closed_at = now(),
        offer = jsonb_build_object('key', p_option_key, 'label', v_label, 'expiresAt', now() + interval '7 days')
    where id = v_call.id;

  if v_call.athlete_id is not null then
    select split_part(full_name, ' ', 1) into v_name from public.athlete_profiles where id = v_call.athlete_id;
    perform public.message_session_families_to(
      v_call.athlete_id,
      'Thanks for the intro call! For ' || coalesce(v_name, 'your athlete') || '''s first session I''d suggest: '
        || v_label || '. Book it from my profile. This offer is good for 7 days.'
    );
  end if;
end;
$$;

revoke all on function public.send_intro_offer(uuid, text) from public, anon;
grant execute on function public.send_intro_offer(uuid, text) to authenticated;

-- Not a fit: closes the call and sends the family a short thank-you.
create or replace function public.close_intro_call(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_call public.coach_intro_calls;
begin
  select * into v_call from public.coach_intro_calls where id = p_call_id and coach_id = v_coach for update;
  if v_call.id is null then
    raise exception 'Intro call not found' using errcode = '42501';
  end if;
  if v_call.status <> 'booked' then
    raise exception 'This intro call was already followed up' using errcode = '22023';
  end if;

  update public.coach_intro_calls set status = 'not_a_fit', closed_at = now() where id = v_call.id;

  if v_call.athlete_id is not null then
    perform public.message_session_families_to(
      v_call.athlete_id,
      'Thanks for taking the time to talk. I don''t think I''m the right fit right now, but I hope you find a great coach. Good luck this season!'
    );
  end if;
end;
$$;

revoke all on function public.close_intro_call(uuid) from public, anon;
grant execute on function public.close_intro_call(uuid) to authenticated;
