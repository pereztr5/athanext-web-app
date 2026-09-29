-- Let the (anonymous) signup page greet an invited athlete by coach name.
-- The token is the capability: possessing it reveals only the coach's name.
create or replace function public.get_referral_invite(_token uuid)
returns table (coach_name text)
language sql security definer set search_path = public
stable
as $$
  select c.name
    from coach_client_referrals r
    join coaches c on c.id = r.coach_id
   where r.invite_token = _token
     and r.status <> 'declined';
$$;

grant execute on function public.get_referral_invite(uuid) to anon, authenticated;
