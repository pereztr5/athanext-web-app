-- ATH-72: group week planner.
-- Coaches plan a week (or one day) of group sessions as drafts, then publish them: the drafts
-- go live and one pick-and-pay card (group_session_offers) is posted to the coach's group chat
-- and shared by link. Families tick sessions on the card and pay once through the existing
-- multi-session checkout. Picking closes at closes_at; the sessions themselves stay bookable
-- from the coach's profile until they start.

create table if not exists public.group_session_offers (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  occurrence_ids uuid[] not null,
  closes_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists group_session_offers_coach_idx on public.group_session_offers (coach_id, created_at desc);

-- Read through get_group_offer only.
alter table public.group_session_offers enable row level security;
revoke all on table public.group_session_offers from anon, authenticated;

alter table public.messages
  add column if not exists offer_id uuid references public.group_session_offers(id) on delete set null;

comment on column public.messages.offer_id is
  'ATH-72: a pick-and-pay card for a published week of group sessions, shown under the message text.';

-- Edits a draft group session the coach owns. p_session takes the same keys as
-- schedule_create_sessions (date and start are Eastern).
create or replace function public.schedule_update_draft(p_occurrence_id uuid, p_session jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_occ public.coach_availability_slot_occurrences;
  v_date date;
  v_start time;
  v_duration integer;
  v_end time;
begin
  select * into v_occ
  from public.coach_availability_slot_occurrences
  where id = p_occurrence_id and coach_id = v_coach_id and is_draft and is_enabled;
  if v_occ.id is null then
    raise exception 'Draft not found' using errcode = '42501';
  end if;

  v_date := coalesce((p_session->>'date')::date, v_occ.occurrence_date);
  v_start := coalesce((p_session->>'start')::time, v_occ.start_time);
  v_duration := coalesce((p_session->>'duration_minutes')::integer, v_occ.duration_minutes);
  v_end := v_start + make_interval(mins => v_duration);
  if extract(epoch from v_start) / 60 + v_duration > 24 * 60 then
    raise exception 'Sessions must end before midnight' using errcode = '22023';
  end if;
  if public.eastern_timestamp(v_date, v_start) <= now() then
    raise exception 'Pick a time that hasn''t passed' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.coach_availability_slot_occurrences as other
    where other.coach_id = v_coach_id and other.id <> p_occurrence_id and other.is_enabled
      and other.occurrence_date = v_date and other.start_time < v_end and v_start < other.end_time
  ) then
    raise exception 'That time overlaps another session' using errcode = '22023';
  end if;
  if p_session ? 'session_name' and nullif(trim(p_session->>'session_name'), '') is null then
    raise exception 'Give it a title' using errcode = '22023';
  end if;

  update public.coach_availability_slot_occurrences
    set occurrence_date = v_date,
        start_time = v_start,
        end_time = v_end,
        duration_minutes = v_duration,
        session_name = coalesce(nullif(trim(p_session->>'session_name'), ''), session_name),
        price = coalesce((p_session->>'price')::numeric, price),
        max_bookings_per_slot = coalesce((p_session->>'capacity')::integer, max_bookings_per_slot),
        location = coalesce(p_session->>'location', location),
        place = case when p_session ? 'place' then nullif(trim(p_session->>'place'), '') else place end,
        pillar_slot = case when p_session ? 'pillar' then nullif(trim(p_session->>'pillar'), '') else pillar_slot end,
        position = case when p_session ? 'position' then nullif(p_session->>'position', '') else position end,
        details = coalesce(p_session->'details', details)
    where id = p_occurrence_id;
end;
$$;

revoke all on function public.schedule_update_draft(uuid, jsonb) from public, anon;
grant execute on function public.schedule_update_draft(uuid, jsonb) to authenticated;

-- Copies the coach's group sessions from p_days earlier into p_from..p_to as drafts.
-- Times that have passed or overlap something already there are skipped.
create or replace function public.schedule_copy_groups(p_from date, p_to date, p_days integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_src record;
  v_date date;
  v_count integer := 0;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can copy sessions' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 6 or p_days not between 1 and 28 then
    raise exception 'Pick a day or a week to copy into' using errcode = '22023';
  end if;

  for v_src in
    select occ.*
    from public.coach_availability_slot_occurrences as occ
    where occ.coach_id = v_coach_id and occ.is_enabled and occ.session_type = 'group'
      and occ.occurrence_date between p_from - p_days and p_to - p_days
    order by occ.occurrence_date, occ.start_time
  loop
    v_date := v_src.occurrence_date + p_days;
    if public.eastern_timestamp(v_date, v_src.start_time) <= now() then
      continue;
    end if;
    if exists (
      select 1 from public.coach_availability_slot_occurrences as other
      where other.coach_id = v_coach_id and other.is_enabled and other.occurrence_date = v_date
        and other.start_time < v_src.end_time and v_src.start_time < other.end_time
    ) then
      continue;
    end if;
    insert into public.coach_availability_slot_occurrences (
      coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
      session_type, location, place, pillar_slot, position, visibility, details, is_draft,
      is_enabled, max_bookings_per_slot
    ) values (
      v_coach_id, v_date, v_src.session_name, v_src.price, v_src.duration_minutes, v_src.start_time,
      v_src.end_time, 'group', v_src.location, v_src.place, v_src.pillar_slot, v_src.position,
      v_src.visibility, v_src.details, true, true, v_src.max_bookings_per_slot
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.schedule_copy_groups(date, date, integer) from public, anon;
grant execute on function public.schedule_copy_groups(date, date, integer) to authenticated;

-- Publishes the coach's drafts in p_from..p_to and creates one card for every live group
-- session in that range. With p_post_to_channel, p_message is posted to the coach's group
-- chat with the card; '{link}' in it becomes p_link_base || offer id. Returns the offer id.
create or replace function public.schedule_publish_groups(
  p_from date,
  p_to date,
  p_title text,
  p_closes_at timestamptz,
  p_post_to_channel boolean,
  p_message text,
  p_link_base text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_ids uuid[];
  v_offer_id uuid;
  v_conversation_id uuid;
  v_body text;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can publish sessions' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 6 then
    raise exception 'Publish a day or a week at a time' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.coach_availability_slot_occurrences
    where coach_id = v_coach_id and is_draft and is_enabled and occurrence_date between p_from and p_to
  ) then
    raise exception 'There are no drafts to publish' using errcode = '22023';
  end if;

  update public.coach_availability_slot_occurrences
    set is_draft = false
    where coach_id = v_coach_id and is_draft and is_enabled and occurrence_date between p_from and p_to;

  select array_agg(id order by occurrence_date, start_time) into v_ids
  from public.coach_availability_slot_occurrences
  where coach_id = v_coach_id and is_enabled and not is_draft and session_type = 'group'
    and occurrence_date between p_from and p_to
    and public.eastern_timestamp(occurrence_date, start_time) > now();

  insert into public.group_session_offers (coach_id, title, occurrence_ids, closes_at)
    values (v_coach_id, left(coalesce(nullif(trim(p_title), ''), 'Group sessions'), 120), v_ids, p_closes_at)
    returning id into v_offer_id;

  if p_post_to_channel then
    v_body := replace(left(trim(coalesce(p_message, '')), 900), '{link}', coalesce(p_link_base, '') || v_offer_id::text);
    if char_length(v_body) = 0 then
      v_body := 'New group sessions are up.';
    end if;
    v_conversation_id := public.get_or_create_my_coach_channel();
    insert into public.messages (conversation_id, sender_id, body, offer_id)
      values (v_conversation_id, auth.uid(), v_body, v_offer_id);
    update public.conversations
      set last_message_at = now(), last_message_text = left(v_body, 200)
      where id = v_conversation_id;
  end if;

  return v_offer_id;
end;
$$;

revoke all on function public.schedule_publish_groups(date, date, text, timestamptz, boolean, text, text) from public, anon;
grant execute on function public.schedule_publish_groups(date, date, text, timestamptz, boolean, text, text) to authenticated;

-- A card as families see it: its sessions with spots left, and which ones the viewer's
-- athlete already holds. Anyone with the link can read it.
create or replace function public.get_group_offer(p_offer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select coalesce(
      (select profile.athlete_id from public.user_profiles as profile where profile.id = auth.uid()),
      (select athlete.id from public.athlete_profiles as athlete where athlete.user_id = auth.uid() limit 1)
    ) as athlete_id
  )
  select jsonb_build_object(
    'id', offer.id,
    'title', offer.title,
    'closes_at', offer.closes_at,
    'closed', offer.closes_at <= now(),
    'coach_id', coach.id,
    'coach_name', coach.name,
    'coach_slug', coach.slug,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', occ.id,
        'date', occ.occurrence_date,
        'start_time', occ.start_time,
        'end_time', occ.end_time,
        'session_name', occ.session_name,
        'price', occ.price,
        'capacity', occ.max_bookings_per_slot,
        'location', occ.location,
        'place', occ.place,
        'details', occ.details,
        'booked_count', (
          select count(*) from public.coach_slot_bookings as b
          where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
        ),
        'my_status', (
          select b.status from public.coach_slot_bookings as b, viewer
          where b.occurrence_id = occ.id and b.athlete_id = viewer.athlete_id
            and b.status in ('requested', 'pending_payment', 'booked', 'completed')
          order by b.created_at desc limit 1
        ),
        'started', public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
      ) order by occ.occurrence_date, occ.start_time)
      from public.coach_availability_slot_occurrences as occ
      where occ.id = any(offer.occurrence_ids) and occ.is_enabled and not occ.is_draft
    ), '[]'::jsonb)
  )
  from public.group_session_offers as offer
  join public.coaches as coach on coach.id = offer.coach_id
  where offer.id = p_offer_id;
$$;

grant execute on function public.get_group_offer(uuid) to anon, authenticated;
