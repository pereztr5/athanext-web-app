-- WC4 week post: coach can edit a published group-offer card (when, where, spots, price,
-- add, cancel, close picks). Time/place changes ask booked families to confirm or cancel;
-- price changes apply to new picks only. Refunds reuse the existing cancel-credit path.

alter table public.coach_slot_bookings
  add column if not exists change_ask text
    check (change_ask is null or change_ask in ('pending', 'keep', 'cancel'));

alter table public.coach_slot_bookings
  add column if not exists change_from jsonb;

comment on column public.coach_slot_bookings.change_ask is
  'WC4 week post: pending/keep/cancel after the coach moved time or place on a group offer.';
comment on column public.coach_slot_bookings.change_from is
  'Previous date/start/place when change_ask is set: {date, start_time, place, location}.';

-- Posts p_lines as plain messages under every chat that already shows this offer card.
create or replace function public.post_group_offer_updates(p_offer_id uuid, p_lines text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_conv uuid;
  v_line text;
  v_sent integer := 0;
begin
  if p_lines is null or cardinality(p_lines) = 0 then
    return 0;
  end if;
  for v_conv in
    select distinct m.conversation_id
    from public.messages as m
    where m.offer_id = p_offer_id
  loop
    foreach v_line in array p_lines loop
      if nullif(btrim(v_line), '') is null then
        continue;
      end if;
      insert into public.messages (conversation_id, sender_id, body)
        values (v_conv, v_me, left(btrim(v_line), 900));
      update public.conversations
        set last_message_at = now(), last_message_text = left(btrim(v_line), 200)
        where id = v_conv;
      v_sent := v_sent + 1;
    end loop;
  end loop;
  return v_sent;
end;
$$;

revoke all on function public.post_group_offer_updates(uuid, text[]) from public, anon;
grant execute on function public.post_group_offer_updates(uuid, text[]) to authenticated;

-- Card as families and the coach see it, including cancelled rows and change prompts.
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
    ) as athlete_id,
    (select c.id from public.coaches as c where c.user_id = auth.uid() limit 1) as coach_id
  )
  select jsonb_build_object(
    'id', offer.id,
    'title', offer.title,
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
          select b.paid_amount from public.coach_slot_bookings as b, viewer
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
$$;

grant execute on function public.get_group_offer(uuid) to anon, authenticated;

-- Coach updates the published week card in one go.
create or replace function public.update_group_offer(p_offer_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_offer public.group_session_offers%rowtype;
  v_occ public.coach_availability_slot_occurrences%rowtype;
  v_lines text[] := '{}';
  v_upd jsonb;
  v_add jsonb;
  v_id uuid;
  v_date date;
  v_start time;
  v_end time;
  v_duration integer;
  v_loc text;
  v_place text;
  v_cap integer;
  v_price numeric;
  v_moved boolean;
  v_new_loc boolean;
  v_new_ids uuid[] := '{}';
  v_cancel uuid;
  v_credits integer;
  v_sent integer;
  v_when text;
  v_booking public.coach_slot_bookings%rowtype;
begin
  if v_coach is null then
    raise exception 'Only coaches can edit this post' using errcode = '42501';
  end if;
  select * into v_offer from public.group_session_offers where id = p_offer_id and coach_id = v_coach for update;
  if v_offer.id is null then
    raise exception 'Offer not found' using errcode = '42501';
  end if;

  -- Per-session edits (price applies to new picks; time/place asks booked families).
  for v_upd in select * from jsonb_array_elements(coalesce(p_patch->'updates', '[]'::jsonb))
  loop
    v_id := (v_upd->>'id')::uuid;
    if v_id is null or not (v_id = any(v_offer.occurrence_ids)) then
      continue;
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(coalesce(p_patch->'cancel_ids', '[]'::jsonb)) as x
      where x::uuid = v_id
    ) then
      continue;
    end if;

    select * into v_occ from public.coach_availability_slot_occurrences
      where id = v_id and coach_id = v_coach and is_enabled for update;
    if v_occ.id is null then
      continue;
    end if;

    v_date := coalesce((v_upd->>'date')::date, v_occ.occurrence_date);
    v_start := coalesce((v_upd->>'start')::time, v_occ.start_time);
    v_duration := v_occ.duration_minutes;
    v_end := v_start + make_interval(mins => v_duration);
    v_loc := coalesce(v_upd->>'location', v_occ.location);
    v_place := case
      when v_upd ? 'place' then nullif(trim(v_upd->>'place'), '')
      else v_occ.place
    end;
    if v_loc = 'online' then
      v_place := null;
    elsif v_place is null and v_loc = 'in-person' then
      v_place := v_occ.place;
    end if;
    -- Where in the UI is a place name or "Video call"; map to location/place.
    if v_upd ? 'where' then
      if trim(v_upd->>'where') = 'Video call' then
        v_loc := 'online';
        v_place := null;
      else
        v_loc := 'in-person';
        v_place := nullif(trim(v_upd->>'where'), '');
      end if;
    end if;
    v_cap := coalesce((v_upd->>'capacity')::integer, v_occ.max_bookings_per_slot);
    v_price := coalesce((v_upd->>'price')::numeric, v_occ.price);
    if v_cap < greatest(2, (
      select count(*)::integer from public.coach_slot_bookings b
      where b.occurrence_id = v_occ.id and b.status in ('requested', 'pending_payment', 'booked', 'completed')
    )) then
      raise exception 'Spots can''t go below who''s already booked' using errcode = '22023';
    end if;
    if public.eastern_timestamp(v_date, v_start) <= now() then
      raise exception 'Pick a time that hasn''t passed' using errcode = '22023';
    end if;

    v_moved := v_date is distinct from v_occ.occurrence_date or v_start is distinct from v_occ.start_time;
    v_new_loc := v_loc is distinct from v_occ.location or coalesce(v_place, '') is distinct from coalesce(v_occ.place, '');

    if v_moved or v_new_loc then
      update public.coach_slot_bookings
        set change_ask = 'pending',
            change_from = jsonb_build_object(
              'date', v_occ.occurrence_date,
              'start_time', v_occ.start_time,
              'place', v_occ.place,
              'location', v_occ.location
            ),
            updated_at = now()
        where occurrence_id = v_occ.id
          and status in ('booked', 'pending_payment');
    end if;

    update public.coach_availability_slot_occurrences
      set occurrence_date = v_date,
          start_time = v_start,
          end_time = v_end,
          location = v_loc,
          place = v_place,
          max_bookings_per_slot = v_cap,
          price = v_price,
          details = case
            when v_price is distinct from v_occ.price and not (details ? 'price_from')
              then coalesce(details, '{}'::jsonb) || jsonb_build_object('price_from', v_occ.price)
            when v_price is distinct from v_occ.price
              then details
            else details
          end
      where id = v_occ.id;

    if v_moved then
      v_lines := array_append(v_lines,
        coalesce(v_occ.session_name, 'Group session') || ' moved to ' ||
        to_char(v_date, 'Dy, Mon FMDD') || ', ' || to_char(v_start, 'FMHH12:MI am'));
    end if;
    if v_new_loc then
      v_lines := array_append(v_lines,
        coalesce(v_occ.session_name, 'Group session') || ' is now at ' ||
        case when v_loc = 'online' then 'Video call' else coalesce(v_place, 'In person') end);
    end if;
    if v_price is distinct from v_occ.price then
      v_lines := array_append(v_lines,
        coalesce(v_occ.session_name, 'Group session') || ' is now $' ||
        trim(to_char(v_price, 'FM999990')) || ' for new picks');
    end if;
    if v_cap is distinct from v_occ.max_bookings_per_slot then
      v_lines := array_append(v_lines,
        coalesce(v_occ.session_name, 'Group session') || ' now has ' || v_cap ||
        case when v_cap = 1 then ' spot' else ' spots' end);
    end if;
  end loop;

  -- Cancels: reuse coach cancel-credit path inline so paid bookings become credits.
  for v_cancel in
    select x::uuid from jsonb_array_elements_text(coalesce(p_patch->'cancel_ids', '[]'::jsonb)) as t(x)
  loop
    if not (v_cancel = any(v_offer.occurrence_ids)) then
      continue;
    end if;
    select * into v_occ from public.coach_availability_slot_occurrences
      where id = v_cancel and coach_id = v_coach and is_enabled for update;
    if v_occ.id is null then
      continue;
    end if;
    v_credits := 0;
    v_when := to_char(v_occ.occurrence_date, 'Dy, Mon FMDD') || ' at ' || to_char(v_occ.start_time, 'FMHH12:MI am');
    perform public.message_session_families(
      v_occ.id,
      'I had to cancel ' || coalesce(v_occ.session_name, 'our group session') || ' on ' || v_when ||
        '. If it was paid, it comes back as a session credit with me.'
    );
    for v_booking in
      select * from public.coach_slot_bookings
      where occurrence_id = v_occ.id and status in ('requested', 'pending_payment', 'booked')
      for update
    loop
      if v_booking.status = 'booked' and v_booking.payment_status in ('paid', 'credit') then
        if v_booking.payment_status = 'credit' and exists (
          select 1 from public.package_purchases
          where id = v_booking.credit_purchase_id and status = 'active'
            and (expiry_date is null or expiry_date > now())
        ) then
          update public.package_purchases
            set sessions_remaining = least(sessions_total, sessions_remaining + 1), updated_at = now()
            where id = v_booking.credit_purchase_id;
        else
          insert into public.package_purchases (
            coach_id, user_id, package_id, source, source_booking_id, sessions_total, sessions_remaining,
            status, purchase_date, expiry_date, total_amount
          )
          select v_coach, athlete.user_id, null, 'cancel_credit', v_booking.id, 1, 1,
                 'active', now(), now() + interval '90 days', 0
          from public.athlete_profiles as athlete where athlete.id = v_booking.athlete_id;
        end if;
        v_credits := v_credits + 1;
      end if;
      update public.coach_slot_bookings
        set status = 'canceled', canceled_at = now(), updated_at = now(),
            cancellation_reason = 'Cancelled by coach from week post',
            change_ask = case when change_ask = 'pending' then 'cancel' else change_ask end
        where id = v_booking.id;
    end loop;
    update public.coach_availability_slot_occurrences
      set is_enabled = false, disabled_reason = 'removed', canceled_at = now(),
          cancel_reason = 'Cancelled from week post',
          cancel_refund = case
            when v_credits = 0 then 'Nothing was charged'
            when v_credits = 1 then 'The family who paid got a session credit'
            else 'Each family who paid got a session credit'
          end
      where id = v_occ.id;
    v_lines := array_append(v_lines,
      coalesce(v_occ.session_name, 'Group session') || ' on ' || to_char(v_occ.occurrence_date, 'Dy, Mon FMDD') ||
      ' is cancelled' || case when v_credits > 0 then '. Booked families got a session credit' else '' end);
  end loop;

  -- Adds: new live group sessions attached to this offer.
  for v_add in select * from jsonb_array_elements(coalesce(p_patch->'adds', '[]'::jsonb))
  loop
    v_date := (v_add->>'date')::date;
    v_start := (v_add->>'start')::time;
    v_duration := coalesce((v_add->>'duration_minutes')::integer, 60);
    v_end := v_start + make_interval(mins => v_duration);
    if v_date is null or v_start is null then
      continue;
    end if;
    if public.eastern_timestamp(v_date, v_start) <= now() then
      raise exception 'Pick a time that hasn''t passed' using errcode = '22023';
    end if;
    if v_add ? 'where' and trim(v_add->>'where') = 'Video call' then
      v_loc := 'online';
      v_place := null;
    else
      v_loc := coalesce(v_add->>'location', 'in-person');
      v_place := coalesce(nullif(trim(v_add->>'where'), ''), nullif(trim(v_add->>'place'), ''));
      if v_loc = 'online' then v_place := null; end if;
    end if;
    v_cap := greatest(2, coalesce((v_add->>'capacity')::integer, 8));
    v_price := coalesce((v_add->>'price')::numeric, 40);
    insert into public.coach_availability_slot_occurrences (
      coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
      session_type, location, place, pillar_slot, position, visibility, details, is_draft,
      is_enabled, max_bookings_per_slot
    ) values (
      v_coach, v_date,
      left(coalesce(nullif(trim(v_add->>'session_name'), ''), nullif(trim(v_add->>'title'), ''), 'Group session'), 120),
      v_price, v_duration, v_start, v_end, 'group', v_loc, v_place,
      nullif(trim(v_add->>'pillar'), ''), 'Field player', 'open',
      jsonb_build_object('pick_new', true, 'level', 'All levels'),
      false, true, v_cap
    ) returning id into v_id;
    v_new_ids := array_append(v_new_ids, v_id);
    v_lines := array_append(v_lines,
      coalesce(nullif(trim(v_add->>'session_name'), ''), nullif(trim(v_add->>'title'), ''), 'Group session') ||
      ' added on ' || to_char(v_date, 'Dy, Mon FMDD'));
  end loop;

  if cardinality(v_new_ids) > 0 then
    update public.group_session_offers
      set occurrence_ids = occurrence_ids || v_new_ids
      where id = v_offer.id;
  end if;

  if coalesce((p_patch->>'close_picks')::boolean, false) and v_offer.closes_at > now() then
    update public.group_session_offers set closes_at = now() where id = v_offer.id;
    v_lines := array_append(v_lines, 'Picks are closed for this week');
  end if;

  v_sent := public.post_group_offer_updates(v_offer.id, v_lines);
  return jsonb_build_object('lines', to_jsonb(v_lines), 'posted', v_sent);
end;
$$;

revoke all on function public.update_group_offer(uuid, jsonb) from public, anon;
grant execute on function public.update_group_offer(uuid, jsonb) to authenticated;

-- Family answers Still coming / Cancel after a time or place change.
-- Cancel uses the same cancel-credit path as cancel_my_booking (not a card refund).
create or replace function public.answer_group_offer_change(p_occurrence_id uuid, p_keep boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete uuid := coalesce(
    (select profile.athlete_id from public.user_profiles as profile where profile.id = auth.uid()),
    (select athlete.id from public.athlete_profiles as athlete where athlete.user_id = auth.uid() limit 1)
  );
  v_booking public.coach_slot_bookings%rowtype;
  v_credit boolean := false;
begin
  if v_athlete is null then
    raise exception 'Sign in as an athlete or parent' using errcode = '42501';
  end if;
  select * into v_booking from public.coach_slot_bookings
    where occurrence_id = p_occurrence_id and athlete_id = v_athlete
      and status in ('booked', 'pending_payment') and change_ask = 'pending'
    order by created_at desc limit 1
    for update;
  if v_booking.id is null then
    raise exception 'Nothing to confirm' using errcode = '22023';
  end if;

  if p_keep then
    update public.coach_slot_bookings
      set change_ask = 'keep', updated_at = now()
      where id = v_booking.id;
    return jsonb_build_object('kept', true, 'credit', false);
  end if;

  -- Mark the answer first, then cancel for a credit (same path as cancel_my_booking).
  update public.coach_slot_bookings
    set change_ask = 'cancel', updated_at = now()
    where id = v_booking.id;
  select coalesce((public.cancel_my_booking(v_booking.id)->>'credit')::boolean, false) into v_credit;
  return jsonb_build_object('kept', false, 'credit', v_credit);
end;
$$;

revoke all on function public.answer_group_offer_change(uuid, boolean) from public, anon;
grant execute on function public.answer_group_offer_change(uuid, boolean) to authenticated;
