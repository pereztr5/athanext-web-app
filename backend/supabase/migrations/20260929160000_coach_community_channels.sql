-- ATH-21: smallest coach community channel.
-- A channel is a conversations row with is_group = true and owner_coach_id set.
-- The coach is an 'owner' participant; athletes join/leave as 'member' participants.
-- Messages, reads and realtime reuse the existing participant-based chat tables.
-- Membership changes go through these security definer functions, so the
-- existing conversation / participant policies are left unchanged.

alter table public.conversations
  add column if not exists owner_coach_id uuid references public.coaches(id) on delete cascade;

create unique index if not exists conversations_one_channel_per_coach
  on public.conversations (owner_coach_id)
  where is_group and owner_coach_id is not null;

comment on column public.conversations.owner_coach_id is
  'ATH-21: set on a coach community channel (is_group = true).';

-- Channel rows and channel membership may only change through the functions below.
-- They set app.coach_channel_rpc for the current transaction; direct client writes
-- that would create, retarget or rename a channel, or add members, are rejected.
create or replace function public.guard_coach_channel_conversation()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.coach_channel_rpc', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.owner_coach_id is not null then
      raise exception 'Coach channels are created by the coach' using errcode = '42501';
    end if;
  elsif new.owner_coach_id is distinct from old.owner_coach_id
     or (old.owner_coach_id is not null
         and (new.is_group is distinct from old.is_group or new.title is distinct from old.title)) then
    raise exception 'Coach channel details cannot be changed here' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_coach_channel_conversation on public.conversations;
create trigger guard_coach_channel_conversation
  before insert or update on public.conversations
  for each row execute function public.guard_coach_channel_conversation();

create or replace function public.guard_coach_channel_participant()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.coach_channel_rpc', true), '') = 'on' then
    return new;
  end if;
  if exists (
    select 1 from public.conversations conv
    where conv.id = new.conversation_id and conv.owner_coach_id is not null
  ) and (tg_op = 'INSERT' or new.role is distinct from old.role or new.user_id is distinct from old.user_id) then
    raise exception 'Join or leave coach channels from the coach profile' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_coach_channel_participant on public.conversation_participants;
create trigger guard_coach_channel_participant
  before insert or update on public.conversation_participants
  for each row execute function public.guard_coach_channel_participant();

-- Channel for a coach, as seen by the caller (null row values when none exists yet).
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
  where conv.owner_coach_id = p_coach_id and conv.is_group
  limit 1;
$$;

-- Calling coach's channel, created on first use.
create or replace function public.get_or_create_my_coach_channel()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_coach_name text;
  v_conversation_id uuid;
begin
  select profile.coach_id into v_coach_id
  from public.user_profiles profile
  where profile.id = auth.uid();
  if v_coach_id is null then
    raise exception 'Only coaches have a community channel' using errcode = '42501';
  end if;
  perform set_config('app.coach_channel_rpc', 'on', true);

  select conv.id into v_conversation_id
  from public.conversations conv
  where conv.owner_coach_id = v_coach_id and conv.is_group;

  if v_conversation_id is null then
    select coalesce(nullif(trim(coach.name), ''), 'Coach') into v_coach_name
    from public.coaches coach where coach.id = v_coach_id;

    insert into public.conversations (is_group, title, created_by, owner_coach_id)
    values (true, v_coach_name || ' community', auth.uid(), v_coach_id)
    on conflict do nothing
    returning id into v_conversation_id;

    if v_conversation_id is null then
      select conv.id into v_conversation_id
      from public.conversations conv
      where conv.owner_coach_id = v_coach_id and conv.is_group;
    end if;
  end if;

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

-- Athletes subscribe to a coach channel.
create or replace function public.join_coach_channel(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to join' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.conversations conv
    where conv.id = p_conversation_id and conv.is_group and conv.owner_coach_id is not null
  ) then
    raise exception 'Channel not found' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.user_profiles profile
    where profile.id = auth.uid() and profile.coach_id is not null
  ) then
    raise exception 'Only athletes can join coach channels' using errcode = '42501';
  end if;
  perform set_config('app.coach_channel_rpc', 'on', true);

  if not exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = p_conversation_id and p.user_id = auth.uid()
  ) then
    insert into public.conversation_participants (conversation_id, user_id, role)
    values (p_conversation_id, auth.uid(), 'member');
  end if;
end;
$$;

-- Athletes unsubscribe. The owner coach can't leave their own channel.
create or replace function public.leave_coach_channel(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.conversation_participants p
  using public.conversations conv
  where p.conversation_id = p_conversation_id
    and conv.id = p.conversation_id
    and conv.is_group
    and conv.owner_coach_id is not null
    and p.user_id = auth.uid()
    and coalesce(p.role, 'member') <> 'owner';
end;
$$;

revoke all on function public.get_coach_channel(uuid) from public, anon;
revoke all on function public.get_or_create_my_coach_channel() from public, anon;
revoke all on function public.join_coach_channel(uuid) from public, anon;
revoke all on function public.leave_coach_channel(uuid) from public, anon;
grant execute on function public.get_coach_channel(uuid) to authenticated;
grant execute on function public.get_or_create_my_coach_channel() to authenticated;
grant execute on function public.join_coach_channel(uuid) to authenticated;
grant execute on function public.leave_coach_channel(uuid) to authenticated;
