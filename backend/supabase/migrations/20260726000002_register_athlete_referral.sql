-- An organic signup that names a coach must LINK the coach's pre-existing
-- invite for that email instead of colliding with unique (coach_id, client_email).
create or replace function public.register_athlete_referral(_coach_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  _athlete uuid;
  _email text;
  _existing_id uuid;
  _existing_status text;
begin
  select athlete_id, email into _athlete, _email
    from user_profiles where id = auth.uid();
  if _athlete is null then
    raise exception 'caller has no athlete profile';
  end if;
  select id, status into _existing_id, _existing_status
    from coach_client_referrals
   where coach_id = _coach_id and client_email = lower(_email);
  if _existing_id is not null then
    -- Coach already added this email: link the account; athlete still
    -- attests via My Coaches / checkout (double confirm preserved).
    update coach_client_referrals
       set athlete_id = _athlete,
           status = case when _existing_status = 'invited'
                         then 'pending_confirmation' else _existing_status end
     where id = _existing_id;
    return 'linked';
  end if;
  insert into coach_client_referrals
    (coach_id, client_email, athlete_id, initiated_by, relationship_source, status)
  values
    (_coach_id, lower(_email), _athlete, 'athlete', 'offline', 'pending_confirmation');
  return 'created';
end;
$$;

grant execute on function public.register_athlete_referral(uuid) to authenticated;
