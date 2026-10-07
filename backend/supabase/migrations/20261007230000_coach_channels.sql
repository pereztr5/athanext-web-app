-- Messages "New channel" (Working Copy): a coach can run several group chats. The community
-- created on first join stays the main one (used by group week offers and the profile Join);
-- extra channels are created by the coach and joined from their profile.

drop index if exists public.conversations_one_channel_per_coach;
alter table public.conversations add column if not exists channel_primary boolean not null default false;
alter table public.conversations add column if not exists channel_description text
  check (channel_description is null or length(channel_description) <= 140);
update public.conversations set channel_primary = true where is_group and owner_coach_id is not null;
create unique index conversations_one_main_channel_per_coach
  on public.conversations (owner_coach_id) where is_group and owner_coach_id is not null and channel_primary;

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
  where conv.owner_coach_id = p_coach_id and conv.is_group and conv.channel_primary;

  if v_conversation_id is null then
    insert into public.conversations (is_group, title, created_by, owner_coach_id, channel_primary)
    values (true, v_coach_name || ' community', v_coach_user_id, p_coach_id, true)
    on conflict do nothing
    returning id into v_conversation_id;

    if v_conversation_id is null then
      select conv.id into v_conversation_id
      from public.conversations conv
      where conv.owner_coach_id = p_coach_id and conv.is_group and conv.channel_primary;
    end if;
  end if;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_conversation_id, v_coach_user_id, 'owner')
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$$;

-- The main channel, as before.
create or replace function public.get_coach_channel(p_coach_id uuid)
returns table (conversation_id uuid, title text, member_count integer, is_member boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    conv.id,
    conv.title,
    (select count(*)::integer from public.conversation_participants p
      where p.conversation_id = conv.id and coalesce(p.role, 'member') <> 'owner'),
    exists (select 1 from public.conversation_participants p
      where p.conversation_id = conv.id and p.user_id = auth.uid())
  from public.conversations conv
  where conv.owner_coach_id = p_coach_id and conv.is_group and conv.channel_primary
  limit 1;
$$;

-- Every channel a coach runs, main one first.
create or replace function public.get_coach_channels(p_coach_id uuid)
returns table (conversation_id uuid, title text, description text, member_count integer, is_member boolean, is_main boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    conv.id,
    conv.title,
    conv.channel_description,
    (select count(*)::integer from public.conversation_participants p
      where p.conversation_id = conv.id and coalesce(p.role, 'member') <> 'owner'),
    exists (select 1 from public.conversation_participants p
      where p.conversation_id = conv.id and p.user_id = auth.uid()),
    conv.channel_primary
  from public.conversations conv
  where conv.owner_coach_id = p_coach_id and conv.is_group
  order by conv.channel_primary desc, conv.created_at;
$$;

-- Coach: a new group chat families can join from the profile.
create or replace function public.create_coach_channel(p_title text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_title text := left(btrim(coalesce(p_title, '')), 60);
  v_id uuid;
  v_main boolean;
begin
  if v_coach is null then
    raise exception 'Only coaches can create channels' using errcode = '42501';
  end if;
  if v_title = '' then
    raise exception 'Name the channel' using errcode = '22023';
  end if;
  if (select count(*) from public.conversations where owner_coach_id = v_coach and is_group) >= 10 then
    raise exception 'Up to 10 channels' using errcode = '22023';
  end if;
  v_main := not exists (select 1 from public.conversations where owner_coach_id = v_coach and is_group and channel_primary);
  perform set_config('app.coach_channel_rpc', 'on', true);
  insert into public.conversations (is_group, title, created_by, owner_coach_id, channel_primary, channel_description)
  values (true, v_title, auth.uid(), v_coach, v_main, nullif(left(btrim(coalesce(p_description, '')), 140), ''))
  returning id into v_id;
  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  return v_id;
end;
$$;

revoke all on function public.get_coach_channels(uuid) from public, anon;
grant execute on function public.get_coach_channels(uuid) to authenticated;
revoke all on function public.create_coach_channel(text, text) from public, anon;
grant execute on function public.create_coach_channel(text, text) to authenticated;
