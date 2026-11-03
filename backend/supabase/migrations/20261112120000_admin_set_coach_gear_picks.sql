-- ATH-123: admins can set which AthaNext store products appear on any coach's profile.
-- Same handle checks and 12-item cap as set_my_gear_picks; only is_admin() may call it.
-- Safe to run more than once.

create or replace function public.admin_set_coach_gear_picks(p_coach_id uuid, p_handles text[])
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handles text[];
begin
  if not public.is_admin() then
    raise exception 'Only admins can set another coach''s gear picks' using errcode = '42501';
  end if;

  if p_coach_id is null or not exists (select 1 from public.coaches where id = p_coach_id) then
    raise exception 'Coach not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(handle order by first_at), '{}')
    into v_handles
  from (
    select lower(trim(h)) as handle, min(ord) as first_at
    from unnest(coalesce(p_handles, '{}'::text[])) with ordinality as t(h, ord)
    where nullif(trim(h), '') is not null
    group by lower(trim(h))
  ) as picked;

  if cardinality(v_handles) > 12 then
    raise exception 'Pick up to 12 products' using errcode = '22023', hint = 'too_many';
  end if;

  if exists (select 1 from unnest(v_handles) as h where h !~ '^[a-z0-9][a-z0-9-]{0,199}$') then
    raise exception 'That product is not in the store' using errcode = '22023', hint = 'bad_handle';
  end if;

  perform pg_advisory_xact_lock(hashtext('coach_gear_picks:' || p_coach_id::text));

  delete from public.coach_gear_picks where coach_id = p_coach_id;

  insert into public.coach_gear_picks (coach_id, product_handle, position)
  select p_coach_id, h, (ord - 1)::smallint
  from unnest(v_handles) with ordinality as t(h, ord);

  return v_handles;
end;
$$;

revoke all on function public.admin_set_coach_gear_picks(uuid, text[]) from public, anon, authenticated;
grant execute on function public.admin_set_coach_gear_picks(uuid, text[]) to authenticated;
