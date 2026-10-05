-- ATH-71: offering sessions from My Schedule.
-- get_coach_athlete_options: the coach's athletes to pick from (anyone who has booked, been
--   offered a session or has a confirmed referral), most recent first.
-- schedule_offer_session: adds athletes to a session's offered_to and messages each of them
--   (and optionally the coach's community channel) with the coach-written text and link.
-- get_session_for_booking: what a shared session link opens. Anyone with the link can see an
--   enabled, published, upcoming session, whatever its visibility; checkout enforces who can book.

create or replace function public.get_coach_athlete_options()
returns table(athlete_id uuid, full_name text, user_id uuid, last_session_date date)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select booking.athlete_id, max(occ.occurrence_date) as last_date
    from public.coach_slot_bookings as booking
    join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
    where booking.coach_id = public.current_coach_id()
    group by booking.athlete_id
    union all
    select referral.athlete_id, null
    from public.coach_client_referrals as referral
    where referral.coach_id = public.current_coach_id()
      and referral.status = 'confirmed'
      and referral.athlete_id is not null
  )
  select athlete.id, athlete.full_name, athlete.user_id, max(mine.last_date)
  from mine
  join public.athlete_profiles as athlete on athlete.id = mine.athlete_id
  group by athlete.id, athlete.full_name, athlete.user_id
  order by max(mine.last_date) desc nulls last, athlete.full_name;
$$;

revoke all on function public.get_coach_athlete_options() from public, anon;
grant execute on function public.get_coach_athlete_options() to authenticated;

create or replace function public.schedule_offer_session(
  p_occurrence_ids uuid[],
  p_athlete_ids uuid[],
  p_post_to_channel boolean,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := public.current_coach_id();
  v_me uuid := auth.uid();
  v_body text := trim(coalesce(p_message, ''));
  v_athlete record;
  v_conversation_id uuid;
  v_sent integer := 0;
  v_channel boolean := false;
begin
  if v_coach_id is null then
    raise exception 'Only coaches can offer sessions' using errcode = '42501';
  end if;
  if coalesce(array_length(p_occurrence_ids, 1), 0) = 0 then
    raise exception 'Pick a session' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_occurrence_ids) as ids(id)
    where not exists (
      select 1 from public.coach_availability_slot_occurrences as occ
      where occ.id = ids.id and occ.coach_id = v_coach_id
    )
  ) then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  if char_length(v_body) = 0 or char_length(v_body) > 1000 then
    raise exception 'Write a short message' using errcode = '22023';
  end if;

  if coalesce(array_length(p_athlete_ids, 1), 0) > 0 then
    update public.coach_availability_slot_occurrences as occ
      set offered_to = (select array_agg(distinct x) from unnest(occ.offered_to || p_athlete_ids) as x)
      where occ.id = any(p_occurrence_ids);
    update public.coach_session_series as series
      set offered_to = (select array_agg(distinct x) from unnest(series.offered_to || p_athlete_ids) as x)
      where series.id in (
        select occ.series_id from public.coach_availability_slot_occurrences as occ
        where occ.id = any(p_occurrence_ids) and occ.series_id is not null
      );
  end if;

  for v_athlete in
    select athlete.id, athlete.full_name, athlete.user_id
    from public.athlete_profiles as athlete
    where athlete.id = any(coalesce(p_athlete_ids, '{}'))
      and athlete.user_id is not null
      and athlete.user_id <> v_me
  loop
    select conversation.id into v_conversation_id
    from public.conversations as conversation
    where not coalesce(conversation.is_group, false)
      and conversation.owner_coach_id is null
      and exists (select 1 from public.conversation_participants p where p.conversation_id = conversation.id and p.user_id = v_me)
      and exists (select 1 from public.conversation_participants p where p.conversation_id = conversation.id and p.user_id = v_athlete.user_id)
    order by conversation.last_message_at desc nulls last
    limit 1;

    if v_conversation_id is null then
      insert into public.conversations (created_by, is_group, title)
        values (v_me, false, v_athlete.full_name)
        returning id into v_conversation_id;
      insert into public.conversation_participants (conversation_id, user_id, role)
        values (v_conversation_id, v_me, 'owner'), (v_conversation_id, v_athlete.user_id, 'member');
    end if;

    insert into public.messages (conversation_id, sender_id, body) values (v_conversation_id, v_me, v_body);
    update public.conversations
      set last_message_at = now(), last_message_text = left(v_body, 200)
      where id = v_conversation_id;
    v_sent := v_sent + 1;
    v_conversation_id := null;
  end loop;

  if p_post_to_channel then
    v_conversation_id := public.get_or_create_my_coach_channel();
    insert into public.messages (conversation_id, sender_id, body) values (v_conversation_id, v_me, v_body);
    update public.conversations
      set last_message_at = now(), last_message_text = left(v_body, 200)
      where id = v_conversation_id;
    v_channel := true;
  end if;

  return jsonb_build_object('sent', v_sent, 'channel', v_channel);
end;
$$;

revoke all on function public.schedule_offer_session(uuid[], uuid[], boolean, text) from public, anon;
grant execute on function public.schedule_offer_session(uuid[], uuid[], boolean, text) to authenticated;

create or replace function public.get_session_for_booking(p_occurrence_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select (to_jsonb(occ) - 'offered_to') || jsonb_build_object(
    'coach_slug', coach.slug,
    'coach_name', coach.name,
    'booked_count', (
      select count(*) from public.coach_slot_bookings as b
      where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
    )
  )
  from public.coach_availability_slot_occurrences as occ
  join public.coaches as coach on coach.id = occ.coach_id
  where occ.id = p_occurrence_id
    and occ.is_enabled
    and not occ.is_draft
    and public.eastern_timestamp(occ.occurrence_date, occ.start_time) + interval '10 minutes' > now();
$$;

grant execute on function public.get_session_for_booking(uuid) to anon, authenticated;
