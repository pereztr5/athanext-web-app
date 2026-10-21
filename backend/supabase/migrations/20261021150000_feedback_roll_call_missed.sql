-- Session feedback, roll call and missed athletes (fix/scheduling-core).
--
-- 1. feedback_missed_gets_short_message(): the one switch for families of athletes marked as
--    missed on a group session. True: they get a short "missed this session" message instead
--    of the group summary (bell and session page). To go back to everyone getting the
--    summary, recreate it returning false. Nothing else needs to change.
-- 2. feedback_missed_message(booking): "<Athlete> was marked as missed for <session> on
--    <date>. Message <coach> if that's not right."
-- 3. get_feedback_screen: each athlete's parent name for the roll call, and the switch above.
-- 4. get_athlete_session: the session score for families (session_scores is coach-only under
--    RLS, so it comes through this security definer function), and the missed message.
-- 5. get_my_notifications: the summary notification only for athletes who came; missed
--    athletes' families get the missed message.
--
-- Function bodies are the live definitions with only the changes above.

create or replace function public.feedback_missed_gets_short_message()
returns boolean
language sql
stable
as $$ select true $$;

comment on function public.feedback_missed_gets_short_message() is
  'Switch: families of athletes marked as missed get a short missed message instead of the group summary. Return false to send them the summary again.';

create or replace function public.feedback_missed_message(p_booking_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select split_part(coalesce(a.full_name, 'Your athlete'), ' ', 1)
    || ' was marked as missed for '
    || case when o.session_type = 'group' then coalesce(nullif(trim(o.session_name), ''), 'the group session') else 'the 1-on-1' end
    || ' on ' || to_char(o.occurrence_date, 'FMDy, Mon FMDD')
    || '. Message ' || coalesce(nullif(split_part(c.name, ' ', 1), ''), 'your coach') || ' if that''s not right.'
  from public.coach_slot_bookings b
  join public.coach_availability_slot_occurrences o on o.id = b.occurrence_id
  join public.coaches c on c.id = o.coach_id
  left join public.athlete_profiles a on a.id = b.athlete_id
  where b.id = p_booking_id
$$;

revoke all on function public.feedback_missed_message(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_feedback_screen(p_slot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach uuid := public.current_coach_id();
begin
  if not exists (
    select 1 from public.coach_availability_slot_occurrences where id = p_slot_id and coach_id = v_coach
  ) then
    raise exception 'Session not found' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'id', occ.id,
      'date', occ.occurrence_date,
      'start_time', occ.start_time,
      'end_time', occ.end_time,
      'session_name', occ.session_name,
      'session_type', occ.session_type,
      'pillar', occ.pillar_slot,
      'location', occ.location,
      'place', occ.place,
      'ended', public.eastern_timestamp(occ.occurrence_date, occ.end_time) <= now(),
      'started', public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now(),
      'summary', feedback.summary,
      'no_show', coalesce(feedback.no_show, false),
      'edit_count', coalesce(feedback.edit_count, 0),
      'submitted', feedback.id is not null,
      'score', (select score.score from public.session_scores as score where score.slot_id = occ.id),
      'missed_gets_short_message', public.feedback_missed_gets_short_message(),
      'athletes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'booking_id', booking.id,
          'athlete_id', booking.athlete_id,
          'name', coalesce(athlete.full_name, 'Athlete'),
          'image_url', athlete.profile_image_url,
          'age', case when athlete.date_of_birth is not null
            then date_part('year', age(occ.occurrence_date, athlete.date_of_birth))::int end,
          'position', nullif(trim(athlete.position), ''),
          'parent_name', (
            select up.name from public.user_profiles up
            where (up.athlete_id = athlete.id or up.id = athlete.user_id)
              and up.persona_type = 'parent' and coalesce(up.name, '') <> '' and up.name <> athlete.full_name
            limit 1
          ),
          'attendance', attendance.attendance,
          'note', note.feedback_to_athlete
        ) order by athlete.full_name)
        from public.coach_slot_bookings as booking
        left join public.athlete_profiles as athlete on athlete.id = booking.athlete_id
        left join public.slot_attendance_v2 as attendance on attendance.booking_id = booking.id
        left join public.slot_feedback_v2 as note on note.booking_id = booking.id
        where booking.occurrence_id = occ.id and booking.status in ('pending_payment', 'booked', 'completed', 'no_show')
      ), '[]'::jsonb)
    )
    from public.coach_availability_slot_occurrences as occ
    left join public.session_feedback_v2 as feedback on feedback.slot_id = occ.id
    where occ.id = p_slot_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_athlete_session(p_occurrence_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_athlete uuid := public.current_athlete_id();
  v_occ public.coach_availability_slot_occurrences;
  v_booking public.coach_slot_bookings;
  v_attendance public.attendance_status;
  v_missed boolean;
begin
  if v_athlete is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  select * into v_booking from public.coach_slot_bookings
  where occurrence_id = p_occurrence_id and athlete_id = v_athlete
  order by case when status = 'canceled' then 1 else 0 end, created_at desc
  limit 1;
  if v_booking.id is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  select * into v_occ from public.coach_availability_slot_occurrences where id = p_occurrence_id;
  select a.attendance into v_attendance from public.slot_attendance_v2 as a where a.booking_id = v_booking.id;
  -- Marked as missed: with the flag on, the family gets the short missed message, not the summary.
  v_missed := public.feedback_missed_gets_short_message() and coalesce(v_attendance::text, 'present') <> 'present';

  return jsonb_build_object(
    'id', v_occ.id,
    'date', v_occ.occurrence_date,
    'start_time', v_occ.start_time,
    'end_time', v_occ.end_time,
    'duration_minutes', v_occ.duration_minutes,
    'session_type', v_occ.session_type,
    'session_name', v_occ.session_name,
    'pillar', v_occ.pillar_slot,
    'price', v_occ.price,
    'location', v_occ.location,
    'place', v_occ.place,
    'started', public.eastern_timestamp(v_occ.occurrence_date, v_occ.start_time) <= now(),
    'ended', public.eastern_timestamp(v_occ.occurrence_date, v_occ.end_time) <= now(),
    'capacity', coalesce(v_occ.max_bookings_per_slot, 1),
    'taken', (select count(*) from public.coach_slot_bookings as b
              where b.occurrence_id = v_occ.id and b.status in ('pending_payment', 'booked', 'completed', 'no_show')),
    'coach', (select jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'photo', coalesce(c.profile_image_url, c.image_url), 'pay_mode', c.pay_mode, 'pay_note', c.pay_note)
              from public.coaches as c where c.id = v_occ.coach_id),
    'booking', jsonb_build_object(
      'id', v_booking.id,
      'status', v_booking.status,
      'payment_status', v_booking.payment_status,
      'paid_amount', (select sum(p.total_amount) from public.payments as p where p.booking_id = v_booking.id),
      'cancellation_reason', v_booking.cancellation_reason,
      'expires_at', v_booking.expires_at
    ),
    'attendance', v_attendance,
    'summary', case when v_missed then null
                    else (select f.summary from public.session_feedback_v2 as f where f.slot_id = v_occ.id and not f.no_show) end,
    -- The session score is shared with families, next to the summary.
    'score', case when v_missed then null
                  else (select s.score from public.session_scores as s
                        join public.session_feedback_v2 as f on f.slot_id = s.slot_id and not f.no_show
                        where s.slot_id = v_occ.id) end,
    'missed_message', case when v_missed then public.feedback_missed_message(v_booking.id) end,
    'note', (select nullif(n.feedback_to_athlete, '') from public.slot_feedback_v2 as n where n.booking_id = v_booking.id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_notifications()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := auth.uid();
  v_coach uuid := public.current_coach_id();
  v_athlete uuid := public.current_athlete_id();
  v_seen timestamptz;
begin
  if v_me is null then
    return '[]'::jsonb;
  end if;
  select coalesce(notifications_seen_at, '-infinity'::timestamptz) into v_seen from public.user_profiles where id = v_me;

  return coalesce((
    select jsonb_agg(item order by (item->>'at')::timestamptz desc)
    from (
      select item from (
        -- Messages from someone else.
        select jsonb_build_object(
          'id', 'message-' || c.id,
          'kind', 'message',
          'title', case when coalesce(c.is_group, false) then coalesce(c.title, 'Group chat')
                        else coalesce((select up.name from public.conversation_participants p
                                       join public.user_profiles up on up.id = p.user_id
                                       where p.conversation_id = c.id and p.user_id <> v_me limit 1), 'Someone') end,
          'body', left(c.last_message_text, 120),
          'image', (select up.image_url from public.conversation_participants p
                    join public.user_profiles up on up.id = p.user_id
                    where p.conversation_id = c.id and p.user_id <> v_me limit 1),
          'at', c.last_message_at,
          'unread', c.last_message_at > coalesce(me.last_read_at, '-infinity'::timestamptz),
          'link', '/chat?conversationId=' || c.id
        ) as item
        from public.conversations as c
        join public.conversation_participants as me on me.conversation_id = c.id and me.user_id = v_me
        where c.last_message_at is not null
          and c.last_message_at > now() - interval '30 days'
          and (select m.sender_id from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) is distinct from v_me

        union all
        -- Coaches: booking requests waiting.
        select jsonb_build_object(
          'id', 'request-' || b.id,
          'kind', 'request',
          'title', split_part(coalesce(a.full_name, 'A family'), ' ', 1),
          'body', 'asked for ' || to_char(o.occurrence_date, 'FMDy, Mon FMDD') || '. Accept or decline within 24 hours.',
          'image', a.profile_image_url,
          'at', b.created_at,
          'unread', b.created_at > v_seen,
          'link', '/schedule?requests=1'
        )
        from public.coach_slot_bookings b
        join public.coach_availability_slot_occurrences o on o.id = b.occurrence_id
        left join public.athlete_profiles a on a.id = b.athlete_id
        where v_coach is not null and b.coach_id = v_coach and b.status = 'requested'

        union all
        -- Coaches: feedback due for sessions that ended in the last week.
        select jsonb_build_object(
          'id', 'feedback-due-' || o.id,
          'kind', 'feedback_due',
          'title', case when o.session_type = 'group' then coalesce(o.session_name, 'Group session') else '1-on-1' end,
          'body', 'on ' || to_char(o.occurrence_date, 'FMDy, Mon FMDD') || ' needs feedback.',
          'image', null,
          'at', public.eastern_timestamp(o.occurrence_date, o.end_time),
          'unread', public.eastern_timestamp(o.occurrence_date, o.end_time) > v_seen,
          'link', '/coach-session-feedback?slotId=' || o.id
        )
        from public.coach_availability_slot_occurrences o
        where v_coach is not null and o.coach_id = v_coach
          and public.eastern_timestamp(o.occurrence_date, o.end_time) between now() - interval '7 days' and now()
          and exists (select 1 from public.coach_slot_bookings b where b.occurrence_id = o.id and b.status in ('booked', 'completed', 'pending_payment', 'no_show'))
          and not exists (select 1 from public.session_feedback_v2 f where f.slot_id = o.id)

        union all
        -- Coaches: new reviews.
        select jsonb_build_object(
          'id', 'review-' || r.id,
          'kind', 'review',
          'title', 'New review',
          'body', r.rating || ' stars' || coalesce(': "' || left(r.review_text, 80) || '"', ''),
          'image', null,
          'at', r.created_at,
          'unread', r.created_at > v_seen,
          'link', '/profile'
        )
        from public.coach_reviews r
        where v_coach is not null and r.coach_id = v_coach and r.created_at > now() - interval '30 days'

        union all
        -- Families: the coach accepted a request, pay to confirm.
        select jsonb_build_object(
          'id', 'accepted-' || b.id,
          'kind', 'accepted',
          'title', c.name,
          'body', 'accepted your request for ' || to_char(o.occurrence_date, 'FMDy, Mon FMDD') || '. Pay to confirm your spot.',
          'image', coalesce(c.profile_image_url, c.image_url),
          'at', b.updated_at,
          'unread', b.updated_at > v_seen,
          'link', '/sessions/' || o.id
        )
        from public.coach_slot_bookings b
        join public.coach_availability_slot_occurrences o on o.id = b.occurrence_id
        join public.coaches c on c.id = b.coach_id
        where v_athlete is not null and b.athlete_id = v_athlete and b.status = 'pending_payment'
          and public.eastern_timestamp(o.occurrence_date, o.start_time) > now()

        union all
        -- Families: the coach shared feedback.
        select jsonb_build_object(
          'id', 'feedback-' || f.id,
          'kind', 'feedback',
          'title', c.name,
          'body', 'shared feedback on your ' || to_char(o.occurrence_date, 'FMDy, Mon FMDD') || ' session.',
          'image', coalesce(c.profile_image_url, c.image_url),
          'at', f.updated_at,
          'unread', f.updated_at > v_seen,
          'link', '/sessions/' || o.id
        )
        from public.session_feedback_v2 f
        join public.coach_availability_slot_occurrences o on o.id = f.slot_id
        join public.coaches c on c.id = o.coach_id
        where v_athlete is not null and not f.no_show and f.summary is not null
          and f.updated_at > now() - interval '30 days'
          and exists (
            select 1 from public.coach_slot_bookings b
            left join public.slot_attendance_v2 att on att.booking_id = b.id
            where b.occurrence_id = o.id and b.athlete_id = v_athlete and b.status in ('booked', 'completed')
              and (not public.feedback_missed_gets_short_message() or coalesce(att.attendance::text, 'present') = 'present')
          )

        union all
        -- Families of an athlete marked as missed: a short message instead of the summary.
        select jsonb_build_object(
          'id', 'missed-' || b.id,
          'kind', 'feedback',
          'title', split_part(coalesce(a.full_name, 'Your athlete'), ' ', 1),
          'body', substr(public.feedback_missed_message(b.id), length(split_part(coalesce(a.full_name, 'Your athlete'), ' ', 1)) + 2),
          'image', coalesce(c.profile_image_url, c.image_url),
          'at', f.updated_at,
          'unread', f.updated_at > v_seen,
          'link', '/sessions/' || o.id
        )
        from public.session_feedback_v2 f
        join public.coach_availability_slot_occurrences o on o.id = f.slot_id
        join public.coaches c on c.id = o.coach_id
        join public.coach_slot_bookings b on b.occurrence_id = o.id and b.athlete_id = v_athlete and b.status in ('booked', 'completed', 'no_show')
        join public.slot_attendance_v2 att on att.booking_id = b.id and att.attendance::text <> 'present'
        left join public.athlete_profiles a on a.id = b.athlete_id
        where v_athlete is not null and not f.no_show
          and public.feedback_missed_gets_short_message()
          and f.updated_at > now() - interval '30 days'

        union all
        -- Both: sessions starting in the next 24 hours.
        select jsonb_build_object(
          'id', 'soon-' || o.id,
          'kind', 'upcoming',
          'title', case when v_coach is not null and o.coach_id = v_coach
                        then case when o.session_type = 'group' then coalesce(o.session_name, 'Group session')
                                  else coalesce((select split_part(a.full_name, ' ', 1) from public.coach_slot_bookings b2
                                                 join public.athlete_profiles a on a.id = b2.athlete_id
                                                 where b2.occurrence_id = o.id and b2.status in ('booked', 'pending_payment') limit 1), '1-on-1') end
                        else c.name end,
          'body', 'starts soon.',
          'starts_at', public.eastern_timestamp(o.occurrence_date, o.start_time),
          'image', null,
          'at', public.eastern_timestamp(o.occurrence_date, o.start_time) - interval '24 hours',
          'unread', public.eastern_timestamp(o.occurrence_date, o.start_time) - interval '24 hours' > v_seen,
          'link', '/sessions/' || o.id
        )
        from public.coach_availability_slot_occurrences o
        join public.coaches c on c.id = o.coach_id
        where public.eastern_timestamp(o.occurrence_date, o.start_time) between now() and now() + interval '24 hours'
          and o.is_enabled
          and exists (
            select 1 from public.coach_slot_bookings b
            where b.occurrence_id = o.id and b.status in ('booked', 'pending_payment')
              and ((v_coach is not null and b.coach_id = v_coach) or (v_athlete is not null and b.athlete_id = v_athlete))
          )
      ) as all_items
      order by (item->>'at')::timestamptz desc
      limit 20
    ) as recent
  ), '[]'::jsonb);
end;
$function$;
