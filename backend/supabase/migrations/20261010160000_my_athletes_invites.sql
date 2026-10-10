-- My Athletes invites tab matching the Working Copy: open invites with the parent, the athlete
-- ("for Ava, 13") and one action each (Approve, Fix email or Resend).

-- Set when an invite email bounces. Nothing writes it yet; the email webhook will.
alter table public.coach_client_referrals
  add column if not exists email_bounced_at timestamptz;

-- Invites the family hasn't finished: sign-ups waiting for approval, and coach invites that
-- are still live. Expired and declined invites stay on the Invites page history.
create or replace function public.get_coach_open_invites()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null then
    raise exception 'Only coaches can see their invites' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(r)::jsonb order by r.sort_rank, r."createdAt" desc)
    from (
      select
        referral.id,
        coalesce(nullif(referral.client_name, ''), account.name, referral.client_email) as parent,
        referral.client_email as email,
        coalesce(nullif(referral.athlete_first_name, ''), split_part(athlete.full_name, ' ', 1)) as athlete,
        extract(year from age(current_date, athlete.date_of_birth))::int as age,
        case
          when referral.initiated_by = 'athlete' then 'approval'
          when referral.email_bounced_at is not null then 'bounced'
          when referral.status = 'invited' then 'sent'
          else 'opened'
        end as status,
        case when referral.initiated_by = 'athlete' then 0 when referral.email_bounced_at is not null then 1 else 2 end as sort_rank,
        referral.created_at as "createdAt"
      from public.coach_client_referrals as referral
      left join public.athlete_profiles as athlete on athlete.id = referral.athlete_id
      left join public.user_profiles as account on account.id = athlete.user_id
      where referral.coach_id = v_coach
        and (
          (referral.initiated_by = 'athlete' and referral.status = 'pending_confirmation')
          or (
            referral.initiated_by <> 'athlete'
            and (referral.status in ('invited', 'pending_confirmation') or (referral.status = 'confirmed' and referral.athlete_id is null))
            and (referral.expires_at is null or referral.expires_at > now())
          )
        )
    ) as r
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_coach_open_invites() from public, anon;
grant execute on function public.get_coach_open_invites() to authenticated;

-- Fix email: change the address on an open coach invite. The app then resends it, which
-- issues a new link to the new address.
create or replace function public.coach_fix_invite_email(p_referral_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_email text := lower(trim(p_email));
begin
  if v_coach is null then
    raise exception 'Only coaches can change invites' using errcode = '42501';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Enter a valid email' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.coach_client_referrals
    where coach_id = v_coach and client_email = v_email and id <> p_referral_id
  ) then
    raise exception 'This email is already a client or invited' using errcode = '23505';
  end if;

  update public.coach_client_referrals
     set client_email = v_email,
         email_bounced_at = null
   where id = p_referral_id
     and coach_id = v_coach
     and initiated_by <> 'athlete'
     and athlete_id is null
     and status in ('invited', 'pending_confirmation', 'confirmed');
  if not found then
    raise exception 'Invite not found' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.coach_fix_invite_email(uuid, text) from public, anon;
grant execute on function public.coach_fix_invite_email(uuid, text) to authenticated;
