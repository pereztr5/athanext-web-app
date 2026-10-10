-- Create session and New schedule (Working Copy 2).
-- 1. schedule_check_clashes: which dates of a session about to be created would be skipped,
--    so the Create session sheet can warn before the coach submits. Same rules as
--    schedule_create_sessions and fill_session_series.
-- 2. schedule_share_session: "Who should book it?" can post to any of the coach's channels,
--    not only the main one. Athletes still go through schedule_offer_session.
-- 3. schedule_publish_groups_to: New schedule publishes the pick-and-pay card to every
--    channel the coach switched on.

-- ---------------------------------------------------------------------------
-- 1. Clash check
-- ---------------------------------------------------------------------------

-- p_session takes the same keys as schedule_create_sessions (times are Eastern date + start).
-- Returns [{date, start}] for every date that would be skipped.
create or replace function public.schedule_check_clashes(p_session jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_visibility text := coalesce(p_session->>'visibility', 'open');
  v_repeat text := coalesce(p_session->>'repeat', 'none');
  v_weeks integer := least(greatest(coalesce((p_session->>'weeks')::integer, 1), 1), 26);
  v_duration integer := coalesce((p_session->>'duration_minutes')::integer, 60);
  v_today date := (timezone('America/New_York', now()))::date;
  v_time jsonb;
  v_first date;
  v_date date;
  v_until date;
  v_start time;
  v_end time;
  v_out jsonb := '[]'::jsonb;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can create sessions' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_session->'times', '[]'::jsonb)) > 24 then
    raise exception 'Too many times' using errcode = '22023';
  end if;

  for v_time in select * from jsonb_array_elements(coalesce(p_session->'times', '[]'::jsonb)) loop
    v_first := (v_time->>'date')::date;
    v_start := (v_time->>'start')::time;
    v_end := v_start + make_interval(mins => v_duration);
    v_until := case
      when v_repeat = 'none' then v_first
      when v_repeat = 'weeks' then v_first + (v_weeks - 1) * 7
      else v_today + (select booking_window_weeks from public.coaches where id = v_coach_id) * 7
    end;

    v_date := v_first;
    while v_date <= v_until loop
      if (v_repeat <> 'none' and exists (
            select 1 from public.coach_time_off as off
            where off.coach_id = v_coach_id and off.off_date = v_date
          ))
        or exists (
          select 1 from public.coach_availability_slot_occurrences as other
          where other.coach_id = v_coach_id and other.occurrence_date = v_date and other.is_enabled
            and other.start_time < v_end and v_start < other.end_time
            -- An offered or group session takes over an unbooked open slot.
            and not (
              v_visibility <> 'open' and other.session_type = 'individual' and other.visibility = 'open'
              and not exists (
                select 1 from public.coach_slot_bookings as b
                where b.occurrence_id = other.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
              )
            )
        )
      then
        v_out := v_out || jsonb_build_object('date', v_date, 'start', v_start);
      end if;
      v_date := v_date + 7;
    end loop;
  end loop;

  return v_out;
end;
$$;

revoke all on function public.schedule_check_clashes(jsonb) from public, anon;
grant execute on function public.schedule_check_clashes(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Share a session to athletes and chosen channels
-- ---------------------------------------------------------------------------

create or replace function public.schedule_share_session(
  p_occurrence_ids uuid[],
  p_athlete_ids uuid[],
  p_channel_ids uuid[],
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_body text := trim(coalesce(p_message, ''));
  v_result jsonb;
  v_channel uuid;
  v_channels integer := 0;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can offer sessions' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_channel_ids, '{}')) as ids(id)
    where not exists (
      select 1 from public.conversations as conv
      where conv.id = ids.id and conv.owner_coach_id = v_coach_id and conv.is_group
    )
  ) then
    raise exception 'Channel not found' using errcode = '42501';
  end if;

  -- Checks the sessions and the message, and messages each athlete.
  v_result := public.schedule_offer_session(p_occurrence_ids, coalesce(p_athlete_ids, '{}'), false, v_body);

  for v_channel in select distinct id from unnest(coalesce(p_channel_ids, '{}')) as ids(id) loop
    insert into public.messages (conversation_id, sender_id, body) values (v_channel, auth.uid(), v_body);
    update public.conversations
      set last_message_at = now(), last_message_text = left(v_body, 200)
      where id = v_channel;
    v_channels := v_channels + 1;
  end loop;

  return jsonb_build_object('sent', coalesce((v_result->>'sent')::integer, 0), 'channels', v_channels);
end;
$$;

revoke all on function public.schedule_share_session(uuid[], uuid[], uuid[], text) from public, anon;
grant execute on function public.schedule_share_session(uuid[], uuid[], uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Publish a planned week to chosen channels
-- ---------------------------------------------------------------------------

-- Same as schedule_publish_groups, but posts the card to each of p_channel_ids ('{link}' in
-- p_message becomes p_link_base || offer id). Returns the offer id.
create or replace function public.schedule_publish_groups_to(
  p_from date,
  p_to date,
  p_title text,
  p_closes_at timestamptz,
  p_channel_ids uuid[],
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
  v_offer_id uuid;
  v_channel uuid;
  v_body text;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can publish sessions' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_channel_ids, '{}')) as ids(id)
    where not exists (
      select 1 from public.conversations as conv
      where conv.id = ids.id and conv.owner_coach_id = v_coach_id and conv.is_group
    )
  ) then
    raise exception 'Channel not found' using errcode = '42501';
  end if;

  v_offer_id := public.schedule_publish_groups(p_from, p_to, p_title, p_closes_at, false, p_message, p_link_base);

  v_body := replace(left(trim(coalesce(p_message, '')), 900), '{link}', coalesce(p_link_base, '') || v_offer_id::text);
  if char_length(v_body) = 0 then
    v_body := 'New group sessions are up.';
  end if;
  for v_channel in select distinct id from unnest(coalesce(p_channel_ids, '{}')) as ids(id) loop
    insert into public.messages (conversation_id, sender_id, body, offer_id)
      values (v_channel, auth.uid(), v_body, v_offer_id);
    update public.conversations
      set last_message_at = now(), last_message_text = left(v_body, 200)
      where id = v_channel;
  end loop;

  return v_offer_id;
end;
$$;

revoke all on function public.schedule_publish_groups_to(date, date, text, timestamptz, uuid[], text, text) from public, anon;
grant execute on function public.schedule_publish_groups_to(date, date, text, timestamptz, uuid[], text, text) to authenticated;
