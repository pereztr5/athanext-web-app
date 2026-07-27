-- coach_client_referrals: offline coach-athlete relationships that waive the platform fee.
-- First migration in this repo; DB is otherwise managed live in the Supabase dashboard.

create table public.coach_client_referrals (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  client_email text not null,
  athlete_id uuid references public.athlete_profiles(id) on delete set null,
  invite_token uuid not null default gen_random_uuid() unique,
  initiated_by text not null default 'coach'
    check (initiated_by in ('coach', 'athlete', 'admin')),
  relationship_source text
    check (relationship_source in ('offline', 'platform')),
  status text not null default 'invited'
    check (status in ('invited', 'pending_confirmation', 'confirmed', 'declined')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (coach_id, client_email)
);

create index idx_ccr_athlete on public.coach_client_referrals (athlete_id);
create index idx_ccr_confirmed_pair
  on public.coach_client_referrals (coach_id, athlete_id)
  where status = 'confirmed';

alter table public.coach_client_referrals enable row level security;

-- coaches have no user_id column; ownership goes through user_profiles.coach_id
create policy ccr_coach_select on public.coach_client_referrals
  for select using (
    coach_id in (select coach_id from public.user_profiles where id = auth.uid())
  );

-- coach acknowledges/dismisses athlete-initiated requests
create policy ccr_coach_update on public.coach_client_referrals
  for update using (
    coach_id in (select coach_id from public.user_profiles where id = auth.uid())
  ) with check (
    coach_id in (select coach_id from public.user_profiles where id = auth.uid())
  );

create policy ccr_coach_delete on public.coach_client_referrals
  for delete using (
    coach_id in (select coach_id from public.user_profiles where id = auth.uid())
  );

create policy ccr_athlete_select on public.coach_client_referrals
  for select using (
    athlete_id in (select athlete_id from public.user_profiles where id = auth.uid())
  );

-- "Already working with a coach?" at athlete signup
create policy ccr_athlete_insert on public.coach_client_referrals
  for insert with check (
    initiated_by = 'athlete'
    and status = 'pending_confirmation'
    and athlete_id in (select athlete_id from public.user_profiles where id = auth.uid())
  );

create policy ccr_admin_all on public.coach_client_referrals
  for all using (
    public.has_role(_role => 'admin'::public.app_role, _user_id => auth.uid())
  );

-- Invited athlete claims their row after signup (token is the join key, not email).
-- Admin-created rows are already confirmed: keep them confirmed, just link the athlete.
create or replace function public.claim_coach_referral(_token uuid, _answer text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _athlete uuid;
begin
  if _answer not in ('offline', 'platform', 'declined') then
    raise exception 'invalid answer %', _answer;
  end if;
  select athlete_id into _athlete from user_profiles where id = auth.uid();
  if _athlete is null then
    raise exception 'caller has no athlete profile';
  end if;
  update coach_client_referrals
     set athlete_id = _athlete,
         relationship_source = coalesce(relationship_source, nullif(_answer, 'declined')),
         status = case
           when status = 'confirmed' then 'confirmed'
           when _answer = 'offline' then 'confirmed'
           else 'declined'
         end,
         confirmed_at = case
           when status = 'confirmed' then confirmed_at
           when _answer = 'offline' then now()
           else null
         end
   where invite_token = _token;
end;
$$;

-- Existing-account athlete answers the gating question (My Coaches / checkout backstop).
create or replace function public.attest_coach_referral(_referral_id uuid, _answer text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if _answer not in ('offline', 'platform', 'declined') then
    raise exception 'invalid answer %', _answer;
  end if;
  update coach_client_referrals
     set relationship_source = nullif(_answer, 'declined'),
         status = case when _answer = 'offline' then 'confirmed' else 'declined' end,
         confirmed_at = case when _answer = 'offline' then now() else null end
   where id = _referral_id
     and status in ('invited', 'pending_confirmation')
     and athlete_id in (select athlete_id from user_profiles where id = auth.uid());
end;
$$;

grant execute on function public.claim_coach_referral(uuid, text) to authenticated;
grant execute on function public.attest_coach_referral(uuid, text) to authenticated;
