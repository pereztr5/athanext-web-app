-- Families: invoices show in the bell ("Coach sent you an invoice for $X") and in a list on Home,
-- so an invoice is easy to find again after the message and email. Safe to run more than once.

-- The family's invoices, open first, newest first (same ownership rule as get_family_invoice).
create or replace function public.get_my_invoices()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(row order by row->>'open' desc, row->>'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', i.id, 'coach', c.name, 'athlete', i.athlete_name, 'service', i.service, 'amount', i.amount,
      'due', i.due_date, 'status', i.status, 'paid_at', i.paid_at, 'created_at', i.created_at,
      'open', i.status = 'open'
    ) as row
    from public.coach_invoices i
    join public.coaches c on c.id = i.coach_id
    join public.athlete_profiles a on a.id = i.athlete_id
    where a.user_id = auth.uid()
      and (i.status = 'open' or i.created_at > now() - interval '180 days')
    order by i.created_at desc
    limit 50
  ) as rows;
$$;

revoke all on function public.get_my_invoices() from public, anon;
grant execute on function public.get_my_invoices() to authenticated;

create or replace function public.get_my_notifications()
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
          and exists (select 1 from public.coach_slot_bookings b where b.occurrence_id = o.id and b.athlete_id = v_athlete and b.status in ('booked', 'completed'))

        union all
        -- Families: an open invoice from a coach (sent or reminded).
        select jsonb_build_object(
          'id', 'invoice-' || i.id || '-' || i.reminders,
          'kind', 'invoice',
          'title', c.name,
          'body', case when i.reminders > 0 then 'reminded you about an invoice for $' else 'sent you an invoice for $' end
                  || case when i.amount = trunc(i.amount) then to_char(i.amount, 'FM999999990') else to_char(i.amount, 'FM999999990.00') end
                  || ', due ' || to_char(i.due_date, 'FMMon FMDD') || '.',
          'image', coalesce(c.profile_image_url, c.image_url),
          'at', coalesce(i.last_reminded_at, i.created_at),
          'unread', coalesce(i.last_reminded_at, i.created_at) > v_seen,
          'link', '/invoices/' || i.id
        )
        from public.coach_invoices i
        join public.coaches c on c.id = i.coach_id
        join public.athlete_profiles a on a.id = i.athlete_id
        where a.user_id = v_me and i.status = 'open'
          and coalesce(i.last_reminded_at, i.created_at) > now() - interval '60 days'

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

notify pgrst, 'reload schema';
