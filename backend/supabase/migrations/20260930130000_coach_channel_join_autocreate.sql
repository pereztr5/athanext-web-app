-- ATH-53: athletes can join any coach's community from the profile, even before
-- the coach has opened Messages -> My community. The channel is created on first
-- join with the same defaults the coach-side creation uses.

-- Shared get-or-create for a coach's channel. Also adds the coach's user as the
-- 'owner' participant so the channel shows up in their Messages. Internal only.
create or replace function public.ensure_coach_channel(p_coach_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_name text;
  v_coach_user_id uuid;
  v_conversation_id uuid;
begin
  select coalesce(nullif(trim(coach.name), ''), 'Coach') into v_coach_name
  from public.coaches coach where coach.id = p_coach_id;
  if v_coach_name is null then
    raise exception 'Coach not found' using errcode = '22023';
  end if;
  perform set_config('app.coach_channel_rpc', 'on', true);

  select profile.id into v_coach_user_id
  from public.user_profiles profile
  where profile.coach_id = p_coach_id
  order by profile.created_at
  limit 1;
  -- A coach without an account can't own a channel; don't let the first athlete become its creator.
  if v_coach_user_id is null then
    raise exception 'This coach hasn''t set up their community yet' using errcode = 'P0001';
  end if;

  select conv.id into v_conversation_id
  from public.conversations conv
  where conv.owner_coach_id = p_coach_id and conv.is_group;

  if v_conversation_id is null then
    insert into public.conversations (is_group, title, created_by, owner_coach_id)
    values (true, v_coach_name || ' community', v_coach_user_id, p_coach_id)
    on conflict do nothing
    returning id into v_conversation_id;

    if v_conversation_id is null then
      select conv.id into v_conversation_id
      from public.conversations conv
      where conv.owner_coach_id = p_coach_id and conv.is_group;
    end if;
  end if;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_conversation_id, v_coach_user_id, 'owner')
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$$;

-- Coach side now reuses the shared creation.
create or replace function public.get_or_create_my_coach_channel()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_conversation_id uuid;
begin
  select profile.coach_id into v_coach_id
  from public.user_profiles profile
  where profile.id = auth.uid();
  if v_coach_id is null then
    raise exception 'Only coaches have a community channel' using errcode = '42501';
  end if;

  v_conversation_id := public.ensure_coach_channel(v_coach_id);

  if not exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = v_conversation_id and p.user_id = auth.uid()
  ) then
    insert into public.conversation_participants (conversation_id, user_id, role)
    values (v_conversation_id, auth.uid(), 'owner');
  end if;

  return v_conversation_id;
end;
$$;

-- Athletes join a coach's channel by coach id, creating it if needed.
-- join_coach_channel rejects coaches; the raise rolls back any channel created here.
create or replace function public.join_coach_community(p_coach_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.coaches coach
    where coach.id = p_coach_id and coalesce(coach.status, 'active') is distinct from 'hidden'
  ) then
    raise exception 'Coach not found' using errcode = '22023';
  end if;
  v_conversation_id := public.ensure_coach_channel(p_coach_id);
  perform public.join_coach_channel(v_conversation_id);
  return v_conversation_id;
end;
$$;

revoke all on function public.ensure_coach_channel(uuid) from public, anon, authenticated;
revoke all on function public.join_coach_community(uuid) from public, anon;
grant execute on function public.join_coach_community(uuid) to authenticated;
