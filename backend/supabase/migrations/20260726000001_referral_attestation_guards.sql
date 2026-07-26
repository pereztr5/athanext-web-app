-- Close self-confirmation bypasses: each side may only confirm the OTHER side's claim.

-- Coaches must use the acknowledge RPC below; the broad update policy allowed
-- a coach to confirm their own coach-initiated rows directly.
drop policy ccr_coach_update on public.coach_client_referrals;

-- Athlete attestation only answers a coach-initiated claim.
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
     and initiated_by = 'coach'
     and athlete_id in (select athlete_id from user_profiles where id = auth.uid());
end;
$$;

-- Token claim only applies to coach- or admin-created invites, never
-- athlete-initiated rows (whose tokens the athlete can read on their own row).
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
   where invite_token = _token
     and initiated_by <> 'athlete';
end;
$$;

-- Coach acknowledgment of an athlete-initiated claim: status transition only.
create or replace function public.acknowledge_coach_referral(_referral_id uuid, _accept boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update coach_client_referrals
     set status = case when _accept then 'confirmed' else 'declined' end,
         confirmed_at = case when _accept then now() else null end
   where id = _referral_id
     and status = 'pending_confirmation'
     and initiated_by = 'athlete'
     and coach_id in (select coach_id from user_profiles where id = auth.uid());
end;
$$;

grant execute on function public.acknowledge_coach_referral(uuid, boolean) to authenticated;
