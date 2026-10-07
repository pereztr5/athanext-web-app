-- Messages (Working Copy): who a one-to-one conversation is about. Coaches get the athlete on
-- their roster (for "{first}'s profile", "Book session", "Parent of {athlete}, {age}" and the
-- latest session notes to share); families get the coach (for "Book").
create or replace function public.get_conversation_context(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_other uuid;
  v_result jsonb;
begin
  select p.user_id into v_other
  from public.conversations c
  join public.conversation_participants me on me.conversation_id = c.id and me.user_id = auth.uid()
  join public.conversation_participants p on p.conversation_id = c.id and p.user_id <> auth.uid()
  where c.id = p_conversation_id and not coalesce(c.is_group, false)
  limit 1;
  if v_other is null then return null; end if;

  if v_coach is not null then
    select jsonb_build_object(
      'athlete_id', a.id,
      'athlete_name', a.full_name,
      'age', extract(year from age((now() at time zone 'America/New_York')::date, a.date_of_birth))::int,
      'holder_name', up.name,
      'holder_is_parent', up.persona_type = 'parent',
      'latest_notes', (
        select jsonb_build_object('slot_id', occ.id, 'date', occ.occurrence_date, 'summary', fb.summary)
        from public.coach_slot_bookings b
        join public.coach_availability_slot_occurrences occ on occ.id = b.occurrence_id
        join public.session_feedback_v2 fb on fb.slot_id = occ.id
        where b.coach_id = v_coach and b.athlete_id = a.id and coalesce(fb.summary, '') <> ''
        order by occ.occurrence_date desc, occ.start_time desc
        limit 1
      )
    ) into v_result
    from public.user_profiles up
    join public.athlete_profiles a on a.id = up.athlete_id or a.user_id = up.id
    where up.id = v_other and public.is_my_athlete(a.id)
    limit 1;
    return v_result;
  end if;

  select jsonb_build_object('coach_id', c.id, 'coach_slug', c.slug, 'coach_name', c.name)
  into v_result
  from public.user_profiles up join public.coaches c on c.id = up.coach_id
  where up.id = v_other;
  return v_result;
end;
$$;
revoke all on function public.get_conversation_context(uuid) from public, anon;
grant execute on function public.get_conversation_context(uuid) to authenticated;
