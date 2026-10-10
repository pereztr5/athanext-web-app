-- Coach athlete page, Working Copy 2.
-- 1. get_coach_athlete adds what the stat strip and Family card need: the open invoices for
--    this athlete (amount due and the invoice to remind), when the main package expires and how
--    the account holder is related to the athlete.
-- 2. set_coach_athlete_goal: the coach can edit the season goal (the family can still change it
--    on their Home).
-- 3. open_family_conversation also opens a thread with athletes on the roster through a
--    confirmed client invite who haven't booked yet, so Message and package offers work for them.

create or replace function public.get_coach_athlete(p_athlete_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_row jsonb;
begin
  if v_coach is null then
    raise exception 'Only coaches can see their athletes' using errcode = '42501';
  end if;
  if p_athlete_id is null or p_athlete_id not in (select public.coach_roster_ids(v_coach)) then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;

  select value into v_row
  from jsonb_array_elements(public.get_coach_roster()) as value
  where value->>'id' = p_athlete_id::text;

  return jsonb_build_object(
    'athlete', v_row,
    'goal', (select nullif(trim(athlete.season_goal), '') from public.athlete_profiles as athlete where athlete.id = p_athlete_id),
    'video', (select nullif(trim(athlete.highlight_video_url), '') from public.athlete_profiles as athlete where athlete.id = p_athlete_id),
    'relation', (
      select account.guardian_relationship
      from public.athlete_profiles as athlete
      join public.user_profiles as account on account.id = athlete.user_id
      where athlete.id = p_athlete_id
    ),
    -- Same package the roster shows: the active one first, else the latest.
    'packageExpires', (
      select purchase.expiry_date
      from public.athlete_profiles as athlete
      join public.package_purchases as purchase on purchase.user_id = athlete.user_id
      join public.coach_packages as package on package.id = purchase.package_id
      where athlete.id = p_athlete_id
        and purchase.coach_id = v_coach
        and purchase.status not in ('canceled', 'cancelled', 'refunded')
      order by (purchase.expiry_date >= current_date and purchase.sessions_remaining > 0) desc,
        purchase.purchase_date desc
      limit 1
    ),
    'due', (
      select jsonb_build_object(
        'amount', sum(invoice.amount),
        'invoiceId', (array_agg(invoice.id order by invoice.due_date, invoice.created_at))[1],
        'reminders', (array_agg(invoice.reminders order by invoice.due_date, invoice.created_at))[1]
      )
      from public.coach_invoices as invoice
      where invoice.coach_id = v_coach and invoice.athlete_id = p_athlete_id and invoice.status = 'open'
      having count(*) > 0
    ),
    'note', coalesce((
      select note.private_note from public.coach_athlete_notes as note
      where note.coach_id = v_coach and note.athlete_id = p_athlete_id
    ), ''),
    'upcoming', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', occ.id,
        'date', occ.occurrence_date,
        'startTime', occ.start_time,
        'endTime', occ.end_time,
        'name', case when occ.session_type = 'group' then occ.session_name else coalesce(occ.pillar_slot, '1-on-1') end,
        'pillar', occ.pillar_slot,
        'kind', occ.session_type,
        'place', coalesce(occ.place, occ.location),
        'price', occ.price,
        'status', booking.status
      ) order by occ.occurrence_date, occ.start_time)
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
      where booking.coach_id = v_coach and booking.athlete_id = p_athlete_id
        and booking.status in ('booked', 'pending_payment', 'requested')
        and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
    ), '[]'::jsonb),
    'past', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', occ.id,
        'date', occ.occurrence_date,
        'startTime', occ.start_time,
        'endTime', occ.end_time,
        'name', case when occ.session_type = 'group' then occ.session_name else coalesce(occ.pillar_slot, '1-on-1') end,
        'pillar', occ.pillar_slot,
        'kind', occ.session_type,
        'place', coalesce(occ.place, occ.location),
        'price', occ.price,
        'status', booking.status,
        'hasFeedback', feedback.id is not null,
        'noShow', coalesce(feedback.no_show, false) or attendance.attendance in ('absent', 'no_show'),
        'summary', case when coalesce(feedback.no_show, false) then null else feedback.summary end,
        'note', note.feedback_to_athlete
      ) order by occ.occurrence_date desc, occ.start_time desc)
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
      left join public.session_feedback_v2 as feedback on feedback.slot_id = occ.id
      left join public.slot_attendance_v2 as attendance on attendance.booking_id = booking.id
      left join public.slot_feedback_v2 as note on note.booking_id = booking.id
      where booking.coach_id = v_coach and booking.athlete_id = p_athlete_id
        and booking.status in ('pending_payment', 'booked', 'completed', 'no_show')
        and public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_coach_athlete(uuid) from public, anon;
grant execute on function public.get_coach_athlete(uuid) to authenticated;

create or replace function public.set_coach_athlete_goal(p_athlete_id uuid, p_goal text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_goal text := nullif(trim(coalesce(p_goal, '')), '');
begin
  if v_coach is null then
    raise exception 'Only coaches can edit a goal' using errcode = '42501';
  end if;
  if p_athlete_id is null or p_athlete_id not in (select public.coach_roster_ids(v_coach)) then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;
  if char_length(coalesce(v_goal, '')) > 300 then
    raise exception 'Keep the goal under 300 characters' using errcode = '22023';
  end if;
  update public.athlete_profiles set season_goal = v_goal where id = p_athlete_id;
end;
$$;

revoke all on function public.set_coach_athlete_goal(uuid, text) from public, anon;
grant execute on function public.set_coach_athlete_goal(uuid, text) to authenticated;

create or replace function public.open_family_conversation(p_athlete_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_coach uuid := public.current_coach_id();
  v_user uuid;
  v_name text;
  v_conversation_id uuid;
begin
  if v_coach is null or not (
    exists (select 1 from public.coach_slot_bookings where coach_id = v_coach and athlete_id = p_athlete_id)
    or p_athlete_id in (select public.coach_roster_ids(v_coach))
  ) then
    raise exception 'Athlete not found' using errcode = '42501';
  end if;
  select user_id, full_name into v_user, v_name from public.athlete_profiles where id = p_athlete_id;
  if v_user is null then
    raise exception 'This family has no account to message yet' using errcode = '22023';
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
  return v_conversation_id;
end;
$$;

revoke all on function public.open_family_conversation(uuid) from public, anon;
grant execute on function public.open_family_conversation(uuid) to authenticated;
