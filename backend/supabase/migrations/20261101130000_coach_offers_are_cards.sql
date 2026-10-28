-- Coach offers in chat are always cards (Oct 27 tech sync): one-on-one, single and group session
-- offers, booking-request "how about these times" replies and the intro-call suggestion all post
-- a group_session_offers row and link the message to it (messages.offer_id), the same way the
-- week post does. A trigger is the safety net: any coach message with a session link that
-- arrives without a card gets one. Old offer messages are converted at the end.
-- Safe to run more than once.

alter table public.group_session_offers
  add column if not exists kind text not null default 'week',
  add column if not exists suggestion jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'group_session_offers_kind_check') then
    alter table public.group_session_offers
      add constraint group_session_offers_kind_check check (kind in ('week', 'offer', 'suggestion'));
  end if;
end $$;

comment on column public.group_session_offers.kind is
  'week = weekly pick-and-pay post; offer = sessions a coach offered (1-on-1, single, group); suggestion = intro-call "book this" (no sessions)';

-- The card behind every coach offer message. Internal: called by the offer functions below.
create or replace function public.create_offer_card(
  p_coach_id uuid,
  p_kind text,
  p_occurrence_ids uuid[],
  p_suggestion jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids uuid[] := array(select distinct unnest(coalesce(p_occurrence_ids, '{}'::uuid[])));
  v_closes timestamptz;
  v_id uuid;
begin
  if p_coach_id is null or p_kind not in ('offer', 'suggestion') then
    raise exception 'Bad offer card' using errcode = '22023';
  end if;
  if p_kind = 'offer' then
    if coalesce(array_length(v_ids, 1), 0) = 0 then
      raise exception 'Pick a session' using errcode = '22023';
    end if;
    if exists (
      select 1 from unnest(v_ids) as ids(id)
      where not exists (
        select 1 from public.coach_availability_slot_occurrences as occ
        where occ.id = ids.id and occ.coach_id = p_coach_id
      )
    ) then
      raise exception 'Session not found' using errcode = '42501';
    end if;
    -- Open until the last offered session starts.
    select max(public.eastern_timestamp(occ.occurrence_date, occ.start_time)) into v_closes
    from public.coach_availability_slot_occurrences as occ
    where occ.id = any(v_ids);
  else
    v_ids := '{}';
    v_closes := coalesce((p_suggestion->>'expires_at')::timestamptz, now() + interval '7 days');
  end if;

  insert into public.group_session_offers (coach_id, title, occurrence_ids, closes_at, kind, suggestion)
    values (p_coach_id, case when p_kind = 'offer' then 'Session offer' else 'First session suggestion' end,
            v_ids, coalesce(v_closes, now() + interval '7 days'), p_kind, p_suggestion)
    returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_offer_card(uuid, text, uuid[], jsonb) from public, anon, authenticated;

-- message_session_families_to gains an optional card (old 2-argument form replaced).
drop function if exists public.message_session_families_to(uuid, text);

create or replace function public.message_session_families_to(p_athlete_id uuid, p_body text, p_offer_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := auth.uid();
  v_user uuid;
  v_name text;
  v_conversation_id uuid;
begin
  select user_id, full_name into v_user, v_name from public.athlete_profiles where id = p_athlete_id;
  if v_user is null or v_user = v_me then
    return;
  end if;
  select conversation.id into v_conversation_id
  from public.conversations as conversation
  where not coalesce(conversation.is_group, false) and conversation.owner_coach_id is null
    and exists (select 1 from public.conversation_participants p where p.conversation_id = conversation.id and p.user_id = v_me)
    and exists (select 1 from public.conversation_participants p where p.conversation_id = conversation.id and p.user_id = v_user)
  order by conversation.last_message_at desc nulls last
  limit 1;
  if v_conversation_id is null then
    insert into public.conversations (created_by, is_group, title) values (v_me, false, v_name)
      returning id into v_conversation_id;
    insert into public.conversation_participants (conversation_id, user_id, role)
      values (v_conversation_id, v_me, 'owner'), (v_conversation_id, v_user, 'member');
  end if;
  insert into public.messages (conversation_id, sender_id, body, offer_id) values (v_conversation_id, v_me, p_body, p_offer_id);
  update public.conversations set last_message_at = now(), last_message_text = left(p_body, 200) where id = v_conversation_id;
end;
$function$;

revoke all on function public.message_session_families_to(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.message_session_families_to(uuid, text, uuid) to service_role;

create or replace function public.schedule_offer_session(p_occurrence_ids uuid[], p_athlete_ids uuid[], p_post_to_channel boolean, p_message text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach_id uuid := public.current_coach_id();
  v_me uuid := auth.uid();
  v_body text := trim(coalesce(p_message, ''));
  v_athlete record;
  v_conversation_id uuid;
  v_sent integer := 0;
  v_channel boolean := false;
  v_offer_id uuid;
begin

  perform public.require_coach_billing_access();  if v_coach_id is null then
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

  -- Every session offer is a card in chat (see post_offer_card), never a bare link.
  v_offer_id := public.create_offer_card(v_coach_id, 'offer', p_occurrence_ids, null);

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

    insert into public.messages (conversation_id, sender_id, body, offer_id) values (v_conversation_id, v_me, v_body, v_offer_id);
    update public.conversations
      set last_message_at = now(), last_message_text = left(v_body, 200)
      where id = v_conversation_id;
    v_sent := v_sent + 1;
    v_conversation_id := null;
  end loop;

  if p_post_to_channel then
    v_conversation_id := public.get_or_create_my_coach_channel();
    insert into public.messages (conversation_id, sender_id, body, offer_id) values (v_conversation_id, v_me, v_body, v_offer_id);
    update public.conversations
      set last_message_at = now(), last_message_text = left(v_body, 200)
      where id = v_conversation_id;
    v_channel := true;
  end if;

  return jsonb_build_object('sent', v_sent, 'channel', v_channel, 'offer_id', v_offer_id);
end;
$function$;

create or replace function public.schedule_share_session(p_occurrence_ids uuid[], p_athlete_ids uuid[], p_channel_ids uuid[], p_message text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach_id uuid := public.current_coach_id();
  v_body text := trim(coalesce(p_message, ''));
  v_result jsonb;
  v_channel uuid;
  v_channels integer := 0;
begin

  perform public.require_coach_billing_access();  if v_coach_id is null then
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
    insert into public.messages (conversation_id, sender_id, body, offer_id)
      values (v_channel, auth.uid(), v_body, nullif(v_result->>'offer_id', '')::uuid);
    update public.conversations
      set last_message_at = now(), last_message_text = left(v_body, 200)
      where id = v_channel;
    v_channels := v_channels + 1;
  end loop;

  return jsonb_build_object('sent', coalesce((v_result->>'sent')::integer, 0), 'channels', v_channels, 'offer_id', v_result->>'offer_id');
end;
$function$;

create or replace function public.suggest_booking_time(p_booking_id uuid, p_date date, p_start time without time zone, p_message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach uuid := public.current_coach_id();
  v_booking public.coach_slot_bookings;
  v_occ public.coach_availability_slot_occurrences;
  v_end time;
  v_new uuid;
  v_when text;
begin
  select * into v_booking from public.coach_slot_bookings
  where id = p_booking_id and coach_id = v_coach
  for update;
  if v_booking.id is null then
    raise exception 'Booking request not found' using errcode = '42501';
  end if;
  if v_booking.status <> 'requested' then
    raise exception 'This request was already answered' using errcode = '22023';
  end if;
  select * into v_occ from public.coach_availability_slot_occurrences where id = v_booking.occurrence_id;
  if v_occ.session_type <> 'individual' then
    raise exception 'Suggest another time works for 1-on-1 requests' using errcode = '22023';
  end if;

  v_end := p_start + make_interval(mins => v_occ.duration_minutes);
  if extract(epoch from p_start) / 60 + v_occ.duration_minutes > 24 * 60 then
    raise exception 'Sessions must end before midnight' using errcode = '22023';
  end if;
  if public.eastern_timestamp(p_date, p_start) <= now() then
    raise exception 'Pick a time that hasn''t passed' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.coach_availability_slot_occurrences as other
    where other.coach_id = v_coach and other.is_enabled
      -- The family's own requested time closes with the request; an open slot stays open.
      and (other.id <> v_occ.id or not (v_occ.details ? 'requested_time'))
      and other.occurrence_date = p_date and other.start_time < v_end and p_start < other.end_time
  ) then
    raise exception 'You already have something at that time' using errcode = '22023';
  end if;

  insert into public.coach_availability_slot_occurrences (
    coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
    session_type, location, place, pillar_slot, position, visibility, offered_to, details,
    is_enabled, max_bookings_per_slot
  ) values (
    v_coach, p_date, v_occ.session_name, v_occ.price, v_occ.duration_minutes, p_start, v_end,
    'individual', v_occ.location, v_occ.place, v_occ.pillar_slot, v_occ.position, 'offered',
    array[v_booking.athlete_id],
    coalesce(v_occ.details, '{}'::jsonb) - 'requested_time' || jsonb_build_object('suggested_for', v_booking.id),
    true, 1
  ) returning id into v_new;

  update public.coach_slot_bookings
    set status = 'canceled', canceled_at = now(), cancellation_reason = 'Coach suggested another time', updated_at = now()
    where id = v_booking.id;
  -- A request for a time the family typed in made its own session; close it with the request.
  if v_occ.details ? 'requested_time' then
    update public.coach_availability_slot_occurrences
      set is_enabled = false, disabled_reason = 'removed'
      where id = v_occ.id;
  end if;

  v_when := to_char(p_date, 'FMDay, Mon FMDD') || ' at ' || ltrim(to_char(p_start, 'FMHH12:MI AM'), '0');
  perform public.message_session_families_to(
    v_booking.athlete_id,
    coalesce(nullif(trim(p_message), ''), 'That time doesn''t work for me. How about ' || v_when || ' (Eastern)? Book it from My Sessions.'),
    public.create_offer_card(v_coach, 'offer', array[v_new], null)
  );
  return v_new;
end;
$function$;

create or replace function public.suggest_booking_open_times(p_booking_id uuid, p_occurrence_ids uuid[], p_message text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach uuid := public.current_coach_id();
  v_booking public.coach_slot_bookings;
  v_occ public.coach_availability_slot_occurrences;
  v_ids uuid[] := array(select distinct unnest(coalesce(p_occurrence_ids, '{}'::uuid[])));
  v_count integer;
  v_times text;
begin
  select * into v_booking from public.coach_slot_bookings
  where id = p_booking_id and coach_id = v_coach
  for update;
  if v_booking.id is null then
    raise exception 'Booking request not found' using errcode = '42501';
  end if;
  if v_booking.status <> 'requested' then
    raise exception 'This request was already answered' using errcode = '22023';
  end if;
  select * into v_occ from public.coach_availability_slot_occurrences where id = v_booking.occurrence_id;
  if v_occ.session_type <> 'individual' then
    raise exception 'Other time works for 1-on-1 requests' using errcode = '22023';
  end if;
  if coalesce(array_length(v_ids, 1), 0) not between 1 and 3 then
    raise exception 'Pick 1 to 3 of your open times' using errcode = '22023';
  end if;

  -- Each pick must be one of the coach's open 1-on-1 slots that nobody holds yet.
  select count(*)::integer into v_count
  from public.coach_availability_slot_occurrences as slot
  where slot.id = any(v_ids)
    and slot.id <> v_occ.id
    and slot.coach_id = v_coach
    and slot.is_enabled
    and not slot.is_draft
    and slot.session_type = 'individual'
    and public.eastern_timestamp(slot.occurrence_date, slot.start_time) > now()
    and not exists (
      select 1 from public.coach_slot_bookings as b
      where b.occurrence_id = slot.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
    );
  if v_count <> array_length(v_ids, 1) then
    raise exception 'One of those times is no longer open' using errcode = '22023';
  end if;

  -- The family goes first in offered_to so "Waiting for the family" names them.
  update public.coach_availability_slot_occurrences as slot
    set offered_to = array[v_booking.athlete_id] || array_remove(coalesce(slot.offered_to, '{}'::uuid[]), v_booking.athlete_id),
        details = coalesce(slot.details, '{}'::jsonb) || jsonb_build_object('suggested_for', v_booking.id)
    where slot.id = any(v_ids);

  update public.coach_slot_bookings
    set status = 'canceled', canceled_at = now(), cancellation_reason = 'Coach suggested another time', updated_at = now()
    where id = v_booking.id;
  if v_occ.details ? 'requested_time' then
    update public.coach_availability_slot_occurrences
      set is_enabled = false, disabled_reason = 'removed'
      where id = v_occ.id;
  end if;

  select string_agg(to_char(slot.occurrence_date, 'FMDay, Mon FMDD') || ' at ' || ltrim(to_char(slot.start_time, 'FMHH12:MI AM'), '0'), '; '
                    order by slot.occurrence_date, slot.start_time)
    into v_times
  from public.coach_availability_slot_occurrences as slot
  where slot.id = any(v_ids);

  perform public.message_session_families_to(
    v_booking.athlete_id,
    coalesce(nullif(trim(p_message), ''), 'That time doesn''t work for me. Any of these would: ' || v_times || ' (Eastern). Book one from My Sessions.'),
    public.create_offer_card(v_coach, 'offer', v_ids, null)
  );
  return array_length(v_ids, 1);
end;
$function$;

create or replace function public.send_intro_offer(p_call_id uuid, p_option_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        || v_label || '. Book it from my profile. This offer is good for 7 days.',
      public.create_offer_card(v_coach, 'suggestion', '{}'::uuid[],
        jsonb_build_object('key', p_option_key, 'label', v_label, 'expires_at', now() + interval '7 days'))
    );
  end if;
end;
$function$;

create or replace function public.get_group_offer(p_offer_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with viewer as (
    select coalesce(
      (select profile.athlete_id from public.user_profiles as profile where profile.id = auth.uid()),
      (select athlete.id from public.athlete_profiles as athlete where athlete.user_id = auth.uid() limit 1)
    ) as athlete_id,
    public.current_coach_id() as coach_id
  )
  select jsonb_build_object(
    'id', offer.id,
    'title', offer.title,
    'kind', offer.kind,
    'suggestion', offer.suggestion,
    'closes_at', offer.closes_at,
    'closed', offer.closes_at <= now(),
    'updated_at', offer.created_at,
    'coach_id', coach.id,
    'coach_name', coach.name,
    'coach_slug', coach.slug,
    'coach_pay_mode', coach.pay_mode,
    'coach_pay_note', coach.pay_note,
    'locations', case
      when viewer.coach_id is not null and viewer.coach_id = offer.coach_id then coalesce(
        (select array_agg(loc order by loc)
         from (
           select distinct nullif(trim(x), '') as loc
           from unnest(coalesce(coach.locations, '{}'::text[])) as x
           where nullif(trim(x), '') is not null
         ) as places),
        '{}'::text[]
      )
      else '{}'::text[]
    end,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', occ.id,
        'date', occ.occurrence_date,
        'start_time', occ.start_time,
        'end_time', occ.end_time,
        'duration_minutes', occ.duration_minutes,
        'session_name', occ.session_name,
        'price', occ.price,
        'price_from', case
          when occ.details ? 'price_from' then (occ.details->>'price_from')::numeric
          else null
        end,
        'capacity', occ.max_bookings_per_slot,
        'location', occ.location,
        'place', occ.place,
        'details', occ.details,
        'cancelled', not occ.is_enabled,
        'cancel_refund', occ.cancel_refund,
        'is_new', coalesce((occ.details->>'pick_new')::boolean, false),
        'booked_count', (
          select count(*) from public.coach_slot_bookings as b
          where b.occurrence_id = occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
        ),
        'pending_confirm_count', (
          select count(*) from public.coach_slot_bookings as b
          where b.occurrence_id = occ.id and b.status in ('booked', 'pending_payment')
            and b.change_ask = 'pending'
        ),
        'my_status', (
          select b.status from public.coach_slot_bookings as b, viewer
          where b.occurrence_id = occ.id and b.athlete_id = viewer.athlete_id
            and b.status in ('requested', 'pending_payment', 'booked', 'completed', 'canceled')
          order by b.created_at desc limit 1
        ),
        'my_booking_id', (
          select b.id from public.coach_slot_bookings as b, viewer
          where b.occurrence_id = occ.id and b.athlete_id = viewer.athlete_id
            and b.status in ('requested', 'pending_payment', 'booked', 'completed')
          order by b.created_at desc limit 1
        ),
        'my_paid_amount', (
          select (
            select sum(p.total_amount) from public.payments as p where p.booking_id = b.id
          )
          from public.coach_slot_bookings as b, viewer
          where b.occurrence_id = occ.id and b.athlete_id = viewer.athlete_id
            and b.status in ('requested', 'pending_payment', 'booked', 'completed', 'canceled')
          order by b.created_at desc limit 1
        ),
        'my_change_ask', (
          select b.change_ask from public.coach_slot_bookings as b, viewer
          where b.occurrence_id = occ.id and b.athlete_id = viewer.athlete_id
            and b.status in ('booked', 'pending_payment')
          order by b.created_at desc limit 1
        ),
        'change_from', (
          select b.change_from from public.coach_slot_bookings as b, viewer
          where b.occurrence_id = occ.id and b.athlete_id = viewer.athlete_id
            and b.status in ('booked', 'pending_payment')
            and b.change_ask is not null
          order by b.created_at desc limit 1
        ),
        'started', public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
      ) order by occ.occurrence_date, occ.start_time)
      from public.coach_availability_slot_occurrences as occ
      where occ.id = any(offer.occurrence_ids) and not occ.is_draft
        and (occ.is_enabled or occ.disabled_reason in ('removed', 'cancelled') or occ.canceled_at is not null)
    ), '[]'::jsonb)
  )
  from public.group_session_offers as offer
  join public.coaches as coach on coach.id = offer.coach_id
  cross join viewer
  where offer.id = p_offer_id;
$function$;

-- Safety net: a coach message that carries a session link (?session=<id>) but no card gets one.
create or replace function public.messages_attach_offer_card()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_coach uuid;
  v_ids uuid[];
begin
  if new.offer_id is not null or new.body !~ '[?&]session=[0-9a-fA-F-]{36}' then
    return new;
  end if;
  select coach_id into v_coach from public.user_profiles where id = new.sender_id;
  if v_coach is null then
    return new;
  end if;
  select array_agg(distinct occ.id) into v_ids
  from regexp_matches(new.body, '[?&]session=([0-9a-fA-F-]{36})', 'g') as m(g)
  join public.coach_availability_slot_occurrences as occ
    on occ.id::text = lower(m.g[1]) and occ.coach_id = v_coach;
  if coalesce(array_length(v_ids, 1), 0) > 0 then
    new.offer_id := public.create_offer_card(v_coach, 'offer', v_ids, null);
  end if;
  return new;
end;
$$;

revoke all on function public.messages_attach_offer_card() from public, anon, authenticated;

drop trigger if exists messages_attach_offer_card on public.messages;
create trigger messages_attach_offer_card
  before insert on public.messages
  for each row execute function public.messages_attach_offer_card();

-- Convert old offers. Session links: one card per message, same rule as the trigger.
do $$
declare
  v_msg record;
  v_ids uuid[];
begin
  for v_msg in
    select m.id, m.body, up.coach_id
    from public.messages as m
    join public.user_profiles as up on up.id = m.sender_id
    where m.offer_id is null and up.coach_id is not null
      and m.body ~ '[?&]session=[0-9a-fA-F-]{36}'
  loop
    select array_agg(distinct occ.id) into v_ids
    from regexp_matches(v_msg.body, '[?&]session=([0-9a-fA-F-]{36})', 'g') as m(g)
    join public.coach_availability_slot_occurrences as occ
      on occ.id::text = lower(m.g[1]) and occ.coach_id = v_msg.coach_id;
    if coalesce(array_length(v_ids, 1), 0) > 0 then
      update public.messages set offer_id = public.create_offer_card(v_msg.coach_id, 'offer', v_ids, null)
      where id = v_msg.id;
    end if;
  end loop;
end $$;

-- Intro-call suggestions already sent: the coach's latest message with that wording, per call.
do $$
declare
  v_call record;
  v_msg uuid;
begin
  for v_call in
    select call.coach_id, call.offer, call.closed_at, athlete.user_id
    from public.coach_intro_calls as call
    join public.athlete_profiles as athlete on athlete.id = call.athlete_id
    where call.status = 'offer_sent' and call.offer ? 'label'
  loop
    select m.id into v_msg
    from public.messages as m
    join public.user_profiles as coach_user on coach_user.id = m.sender_id and coach_user.coach_id = v_call.coach_id
    where m.offer_id is null
      and m.body like 'Thanks for the intro call!%'
      and position(v_call.offer->>'label' in m.body) > 0
      and exists (select 1 from public.conversation_participants p where p.conversation_id = m.conversation_id and p.user_id = v_call.user_id)
    order by m.created_at desc
    limit 1;
    if v_msg is not null then
      update public.messages
        set offer_id = public.create_offer_card(v_call.coach_id, 'suggestion', '{}'::uuid[], jsonb_build_object(
          'key', v_call.offer->>'key',
          'label', v_call.offer->>'label',
          'expires_at', coalesce(v_call.offer->>'expiresAt', (coalesce(v_call.closed_at, now()) + interval '7 days')::text)))
      where id = v_msg;
    end if;
    v_msg := null;
  end loop;
end $$;

notify pgrst, 'reload schema';
