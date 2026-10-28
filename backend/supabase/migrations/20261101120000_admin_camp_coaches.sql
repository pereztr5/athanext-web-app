-- Admin camp editing (/camps): the coach picker lists every coach who has a camp, including
-- coaches whose profile isn't public yet. Admins only. Safe to run more than once.

create or replace function public.admin_list_camp_coaches()
returns table (id uuid, name text, slug text, camps integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select c.id, c.name, c.slug, count(p.id)::integer
    from public.coaches c
    join public.coach_packages p on p.coach_id = c.id and p.kind = 'camp' and p.is_active
    where c.deactivated_at is null
    group by c.id, c.name, c.slug
    order by c.name;
end;
$$;

revoke all on function public.admin_list_camp_coaches() from public, anon;
grant execute on function public.admin_list_camp_coaches() to authenticated;

notify pgrst, 'reload schema';
