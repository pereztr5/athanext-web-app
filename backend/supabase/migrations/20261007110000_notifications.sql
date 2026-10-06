-- ATH-98: the notifications bell. Built from what's already stored, so every item opens the
-- screen it refers to:
--   messages            -> that conversation
--   booking requests    -> My Schedule with the requests open (coaches)
--   feedback due        -> the feedback screen for that session (coaches)
--   new reviews         -> My Profile (coaches)
--   request accepted    -> the session page, to pay (families)
--   feedback shared     -> the session page (families)
--   sessions within 24h -> the session page (both)
-- Messages are unread until the conversation is read; everything else is unread until the
-- bell is opened (user_profiles.notifications_seen_at).

alter table public.user_profiles
  add column if not exists notifications_seen_at timestamptz;

create or replace function public.get_my_notifications()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
          and exists (select 1 from public.coach_slot_bookings b where b.occurrence_id = o.id and b.athlete_id = v_athlete and b.status in ('booked', 'completed'))

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
$$;

revoke all on function public.get_my_notifications() from public, anon;
grant execute on function public.get_my_notifications() to authenticated;

create or replace function public.mark_notifications_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_profiles set notifications_seen_at = now() where id = auth.uid();
$$;

revoke all on function public.mark_notifications_seen() from public, anon;
grant execute on function public.mark_notifications_seen() to authenticated;

-- Under-18 safeguarding strip (ATH-98): in a one-to-one chat with a family whose athlete is
-- under 18, both sides see that the parent or guardian is part of every message about them.
-- Returns null when there's no minor in the conversation.
create or replace function public.get_conversation_safeguard(p_conversation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'athlete_first', split_part(coalesce(a.full_name, 'the athlete'), ' ', 1),
    'holder_name', coalesce(holder.name, 'their parent'),
    'viewer_is_family', holder.id = auth.uid(),
    'held_by_parent', holder.persona_type = 'parent'
  )
  from public.conversations c
  join public.conversation_participants me on me.conversation_id = c.id and me.user_id = auth.uid()
  join public.conversation_participants p on p.conversation_id = c.id
  join public.user_profiles holder on holder.id = p.user_id
  join public.athlete_profiles a on a.id = holder.athlete_id
  where c.id = p_conversation_id
    and not coalesce(c.is_group, false)
    and a.date_of_birth > (now() at time zone 'America/New_York')::date - interval '18 years'
  limit 1;
$$;

revoke all on function public.get_conversation_safeguard(uuid) from public, anon;
grant execute on function public.get_conversation_safeguard(uuid) to authenticated;
