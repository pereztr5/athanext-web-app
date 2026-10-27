-- Week card edits can add an open 1-on-1 (capacity 1) as well as group sessions.
-- Safe to run more than once.

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
    v_cap := greatest(1, coalesce((v_add->>'capacity')::integer, 8));
    -- capacity 1 = open 1-on-1 on the week card; 2+ stays a group session.
    v_price := coalesce((v_add->>'price')::numeric, 40);
    insert into public.coach_availability_slot_occurrences (
      coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
      session_type, location, place, pillar_slot, position, visibility, details, is_draft,
      is_enabled, max_bookings_per_slot
    ) values (
      v_coach, v_date,
      left(coalesce(nullif(trim(v_add->>'session_name'), ''), nullif(trim(v_add->>'title'), ''), case when v_cap = 1 then '1-on-1' else 'Group session' end), 120),
      v_price, v_duration, v_start, v_end, case when v_cap = 1 then 'individual' else 'group' end, v_loc, v_place,
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
