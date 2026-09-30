-- ATH-58: athletes can see who else is in their group session and in a coach's community.
-- Athletes are mostly minors, so other athletes are shown as first name + last initial
-- ("Ava P."), with no photos. The coach of a session keeps seeing full names.
-- Only confirmed bookings (booked / completed) count: pending_payment holds can be
-- started by anyone who opens checkout and may never be paid, and requested bookings
-- may still be declined, so neither lists the athlete nor unlocks the roster.

-- "Ava Parker" -> "Ava P."; a single name is kept as is. Internal only.
create or replace function public.short_display_name(p_full_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when parts is null then null
    when array_length(parts, 1) = 1 then parts[1]
    else parts[1] || ' ' || upper(left(parts[array_length(parts, 1)], 1)) || '.'
  end
  from (select regexp_split_to_array(nullif(btrim(p_full_name), ''), '\s+') as parts) name_parts;
$$;

-- Athletes on a session occurrence. Allowed for athletes (or parents, who own the
-- athlete profile) with their own confirmed booking on it, and for its coach.
create or replace function public.get_session_roster(p_occurrence_id uuid)
returns table (display_name text, is_you boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_is_coach boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in to see who''s coming' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.user_profiles profile
    where profile.id = auth.uid() and profile.coach_id = occ.coach_id
  ) into v_is_coach
  from public.coach_availability_slot_occurrences occ
  where occ.id = p_occurrence_id;
  if v_is_coach is null then
    raise exception 'Session not found' using errcode = '22023';
  end if;

  if not v_is_coach and not exists (
    select 1
    from public.coach_slot_bookings b
    join public.athlete_profiles ap on ap.id = b.athlete_id
    where b.occurrence_id = p_occurrence_id
      and b.status in ('booked', 'completed')
      and (ap.user_id = auth.uid()
        or ap.id = (select profile.athlete_id from public.user_profiles profile where profile.id = auth.uid()))
  ) then
    raise exception 'Only athletes booked into this session can see who''s coming' using errcode = '42501';
  end if;

  return query
  select roster.display_name, roster.is_you
  from (
    select
      case when v_is_coach then coalesce(nullif(btrim(ap.full_name), ''), 'Athlete')
           else coalesce(public.short_display_name(ap.full_name), 'Athlete')
      end as display_name,
      coalesce(ap.user_id = auth.uid()
        or ap.id = (select profile.athlete_id from public.user_profiles profile where profile.id = auth.uid()), false) as is_you
    from (
      select distinct b.athlete_id
      from public.coach_slot_bookings b
      where b.occurrence_id = p_occurrence_id and b.status in ('booked', 'completed')
    ) booked
    left join public.athlete_profiles ap on ap.id = booked.athlete_id
  ) roster
  order by roster.is_you desc, lower(roster.display_name);
end;
$$;

-- Members of a coach community channel, for its participants. The owner coach is
-- listed with their full name and photo; everyone else by first name + last initial,
-- except for the owner coach, who sees full names as they do in their sessions.
create or replace function public.get_community_members(p_conversation_id uuid)
returns table (display_name text, role text, is_you boolean, avatar_url text)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_is_owner boolean;
begin
  if not exists (
    select 1
    from public.conversations conv
    join public.conversation_participants p on p.conversation_id = conv.id
    where conv.id = p_conversation_id
      and conv.is_group
      and conv.owner_coach_id is not null
      and p.user_id = auth.uid()
  ) then
    raise exception 'Join this community to see its members' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = p_conversation_id and p.user_id = auth.uid() and p.role = 'owner'
  ) into v_is_owner;

  return query
  select members.display_name, members.role, members.is_you, members.avatar_url
  from (
    select
      case when coalesce(p.role, 'member') = 'owner'
        then coalesce(nullif(btrim(coach.name), ''), nullif(btrim(profile.name), ''), 'Coach')
        when v_is_owner then coalesce(
          nullif(btrim(profile.name), ''),
          (select ap.full_name from public.athlete_profiles ap
           where ap.user_id = p.user_id order by ap.created_at limit 1),
          'Member')
        else coalesce(
          public.short_display_name(profile.name),
          public.short_display_name((select ap.full_name from public.athlete_profiles ap
                                     where ap.user_id = p.user_id order by ap.created_at limit 1)),
          'Member')
      end as display_name,
      case when coalesce(p.role, 'member') = 'owner' then 'owner' else 'member' end as role,
      p.user_id = auth.uid() as is_you,
      case when coalesce(p.role, 'member') = 'owner'
        then coalesce(profile.image_url, coach.profile_image_url, coach.image_url)
      end as avatar_url
    from public.conversation_participants p
    join public.conversations conv on conv.id = p.conversation_id
    left join public.user_profiles profile on profile.id = p.user_id
    left join public.coaches coach on coach.id = conv.owner_coach_id
    where p.conversation_id = p_conversation_id
  ) members
  order by (members.role = 'owner') desc, lower(members.display_name);
end;
$$;

revoke all on function public.short_display_name(text) from public, anon, authenticated;
revoke all on function public.get_session_roster(uuid) from public, anon;
revoke all on function public.get_community_members(uuid) from public, anon;
grant execute on function public.get_session_roster(uuid) to authenticated;
grant execute on function public.get_community_members(uuid) to authenticated;
