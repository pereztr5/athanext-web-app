-- ATH-12: bound, single-use, expiring coach invites.
-- An invite link can be opened any number of times. It is consumed only when a
-- signed-in athlete whose email matches the invite claims it; the token is then
-- cleared so the link is dead. Coaches can resend, which issues a new token.

alter table public.coach_client_referrals
  add column if not exists client_name text,
  add column if not exists expires_at timestamptz default (now() + interval '14 days');

alter table public.coach_client_referrals
  alter column invite_token drop not null;

-- Unclaimed coach/admin invites get a fresh 14-day window from creation.
update public.coach_client_referrals
   set expires_at = created_at + interval '14 days'
 where initiated_by <> 'athlete'
   and expires_at is null;

-- Tokens on rows that are already answered are dead.
update public.coach_client_referrals
   set invite_token = null
 where status = 'declined'
    or (status = 'confirmed' and athlete_id is not null);

-- One confirmed relationship per (coach, athlete). Keep the earliest; older
-- duplicates (e.g. same athlete invited under two emails) become declined.
with ranked as (
  select id,
         row_number() over (
           partition by coach_id, athlete_id
           order by confirmed_at nulls last, created_at
         ) as rn
    from public.coach_client_referrals
   where status = 'confirmed' and athlete_id is not null
)
update public.coach_client_referrals r
   set status = 'declined'
  from ranked
 where r.id = ranked.id and ranked.rn > 1;

drop index if exists public.idx_ccr_confirmed_pair;
create unique index if not exists ccr_one_confirmed_pair
  on public.coach_client_referrals (coach_id, athlete_id)
  where status = 'confirmed' and athlete_id is not null;

-- Confirm a row for an athlete, or drop it when that pair is already confirmed.
-- Internal helper: callers have already checked who may confirm this row.
create or replace function public.ccr_confirm_row(_referral_id uuid, _athlete uuid, _source text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  _coach uuid;
begin
  select coach_id into _coach from coach_client_referrals where id = _referral_id;
  if exists (
    select 1 from coach_client_referrals
     where coach_id = _coach and athlete_id = _athlete
       and status = 'confirmed' and id <> _referral_id
  ) then
    delete from coach_client_referrals where id = _referral_id;
    return 'already_confirmed';
  end if;
  update coach_client_referrals
     set athlete_id = _athlete,
         status = 'confirmed',
         relationship_source = coalesce(_source, relationship_source),
         confirmed_at = coalesce(confirmed_at, now()),
         invite_token = null
   where id = _referral_id;
  return 'confirmed';
end;
$$;

revoke all on function public.ccr_confirm_row(uuid, uuid, text) from public, anon, authenticated;

-- Public read of an invite link. The token is the capability; it reveals the
-- coach, the invitee's first name, a masked email, and whether the signed-in
-- caller (if any) is the invited person.
drop function if exists public.get_referral_invite(uuid);
create function public.get_referral_invite(_token uuid)
returns table (
  coach_id uuid,
  coach_name text,
  coach_slug text,
  client_name text,
  masked_email text,
  state text,
  email_matches boolean,
  is_athlete boolean
)
language sql security definer set search_path = public
stable
as $$
  select
    r.coach_id,
    c.name,
    c.slug,
    r.client_name,
    left(r.client_email, 1) || '***' || substring(r.client_email from position('@' in r.client_email)),
    case
      when r.status = 'declined' then 'used'
      when r.status = 'confirmed' and r.athlete_id is not null then 'used'
      when r.expires_at is not null and r.expires_at < now() then 'expired'
      else 'valid'
    end,
    coalesce(
      (select lower(u.email) from auth.users u where u.id = auth.uid()) = r.client_email,
      false
    ),
    exists (
      select 1 from user_profiles p
       where p.id = auth.uid() and p.athlete_id is not null
    )
  from coach_client_referrals r
  join coaches c on c.id = r.coach_id
  where r.invite_token = _token
    and r.initiated_by <> 'athlete';
$$;

grant execute on function public.get_referral_invite(uuid) to anon, authenticated;

-- Claim an invite. Consumes the token only on a successful answer by the
-- invited athlete; every failure leaves the invite untouched.
drop function if exists public.claim_coach_referral(uuid, text);
create function public.claim_coach_referral(_token uuid, _answer text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  _row coach_client_referrals%rowtype;
  _athlete uuid;
  _email text;
begin
  if _answer not in ('offline', 'platform', 'declined') then
    raise exception 'invalid answer %', _answer;
  end if;

  select * into _row
    from coach_client_referrals
   where invite_token = _token
     and initiated_by <> 'athlete'
   for update;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if _row.status = 'declined' or (_row.status = 'confirmed' and _row.athlete_id is not null) then
    raise exception 'invite_already_claimed';
  end if;
  if _row.expires_at is not null and _row.expires_at < now() then
    raise exception 'invite_expired';
  end if;

  select athlete_id into _athlete from user_profiles where id = auth.uid();
  if _athlete is null then
    raise exception 'no_athlete_profile';
  end if;
  select lower(email) into _email from auth.users where id = auth.uid();
  if _email is distinct from _row.client_email then
    raise exception 'email_mismatch';
  end if;
  if _row.athlete_id is not null and _row.athlete_id <> _athlete then
    raise exception 'email_mismatch';
  end if;

  if _answer = 'offline' then
    return public.ccr_confirm_row(_row.id, _athlete, 'offline');
  end if;

  update coach_client_referrals
     set athlete_id = _athlete,
         status = 'declined',
         relationship_source = nullif(_answer, 'declined'),
         confirmed_at = null,
         invite_token = null
   where id = _row.id;
  return 'declined';
end;
$$;

grant execute on function public.claim_coach_referral(uuid, text) to authenticated;

-- Existing-account athlete answers a coach invite from My Coaches.
create or replace function public.attest_coach_referral(_referral_id uuid, _answer text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _row coach_client_referrals%rowtype;
begin
  if _answer not in ('offline', 'platform', 'declined') then
    raise exception 'invalid answer %', _answer;
  end if;
  select * into _row
    from coach_client_referrals
   where id = _referral_id
     and status in ('invited', 'pending_confirmation')
     and initiated_by = 'coach'
     and athlete_id in (select athlete_id from user_profiles where id = auth.uid())
   for update;
  if not found then
    return;
  end if;
  if _row.expires_at is not null and _row.expires_at < now() then
    raise exception 'invite_expired';
  end if;
  if _answer = 'offline' then
    perform public.ccr_confirm_row(_row.id, _row.athlete_id, 'offline');
    return;
  end if;
  update coach_client_referrals
     set status = 'declined',
         relationship_source = nullif(_answer, 'declined'),
         confirmed_at = null,
         invite_token = null
   where id = _row.id;
end;
$$;

-- Coach accepts or rejects an athlete-initiated claim.
create or replace function public.acknowledge_coach_referral(_referral_id uuid, _accept boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _row coach_client_referrals%rowtype;
begin
  select * into _row
    from coach_client_referrals
   where id = _referral_id
     and status = 'pending_confirmation'
     and initiated_by = 'athlete'
     and coach_id in (select coach_id from user_profiles where id = auth.uid())
   for update;
  if not found then
    return;
  end if;
  if _accept then
    perform public.ccr_confirm_row(_row.id, _row.athlete_id, null);
  else
    update coach_client_referrals
       set status = 'declined', confirmed_at = null, invite_token = null
     where id = _row.id;
  end if;
end;
$$;

-- Organic signup that names a coach links that coach's invite for the same email.
create or replace function public.register_athlete_referral(_coach_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  _athlete uuid;
  _email text;
  _existing coach_client_referrals%rowtype;
begin
  select athlete_id into _athlete from user_profiles where id = auth.uid();
  if _athlete is null then
    raise exception 'caller has no athlete profile';
  end if;
  select lower(email) into _email from auth.users where id = auth.uid();

  select * into _existing
    from coach_client_referrals
   where coach_id = _coach_id and client_email = _email
   for update;
  if found then
    if _existing.status = 'confirmed' and _existing.athlete_id is null then
      -- Admin-confirmed book-of-business row: the email matches, so link it.
      return public.ccr_confirm_row(_existing.id, _athlete, null);
    end if;
    -- Coach already invited this email: link the account; the athlete still
    -- confirms via the invite link or My Coaches (double confirm preserved).
    update coach_client_referrals
       set athlete_id = coalesce(athlete_id, _athlete),
           status = case when status = 'invited' then 'pending_confirmation' else status end
     where id = _existing.id;
    return 'linked';
  end if;

  insert into coach_client_referrals
    (coach_id, client_email, athlete_id, initiated_by, relationship_source, status, expires_at, invite_token)
  values
    (_coach_id, _email, _athlete, 'athlete', 'offline', 'pending_confirmation', null, null);
  return 'created';
end;
$$;

-- Coach (or admin) reissues an unclaimed invite: new token, new 14-day window.
create or replace function public.resend_coach_referral(_referral_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _token uuid := gen_random_uuid();
begin
  update coach_client_referrals
     set invite_token = _token,
         expires_at = now() + interval '14 days'
   where id = _referral_id
     and initiated_by <> 'athlete'
     and (
       status in ('invited', 'pending_confirmation')
       or (status = 'confirmed' and athlete_id is null)
     )
     and (
       coach_id in (select coach_id from user_profiles where id = auth.uid())
       or public.has_role(auth.uid(), 'admin'::public.app_role)
     );
  if not found then
    raise exception 'invite_not_resendable';
  end if;
  return _token;
end;
$$;

revoke all on function public.resend_coach_referral(uuid) from public, anon;
grant execute on function public.resend_coach_referral(uuid) to authenticated;
