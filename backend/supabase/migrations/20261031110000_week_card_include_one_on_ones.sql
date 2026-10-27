-- Week pick-and-pay card includes open 1-on-1 sessions alongside group sessions.
-- Private/offered 1-on-1s stay off the card. Camp days stay off the card.
-- Safe to run more than once.

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
set search_path to 'public'
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
  where coach_id = v_coach_id and is_enabled and not is_draft
    and camp_id is null
    and (
      session_type = 'group'
      or (session_type = 'individual' and visibility = 'open')
    )
    and occurrence_date between p_from and p_to
    and public.eastern_timestamp(occurrence_date, start_time) > now();

  insert into public.group_session_offers (coach_id, title, occurrence_ids, closes_at)
    values (v_coach_id, left(coalesce(nullif(trim(p_title), ''), 'This week''s sessions'), 120), coalesce(v_ids, '{}'::uuid[]), p_closes_at)
    returning id into v_offer_id;

  if p_post_to_channel then
    v_body := replace(left(trim(coalesce(p_message, '')), 900), '{link}', coalesce(p_link_base, '') || v_offer_id::text);
    if char_length(v_body) = 0 then
      v_body := 'New sessions are up.';
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
