-- Owners no longer delete a coach themselves. They ask AthaNext to remove them, so splits,
-- payouts and package credits can be settled first. Support finishes the request by hand.
-- remove_organization_coach stays callable only as a refusal: the old owner button must not
-- delete anyone once this migration is applied.

create table if not exists public.org_coach_removal_requests (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references public.organizations(id) on delete cascade,
  coach uuid not null references public.coaches(id) on delete cascade,
  requested_by uuid not null references public.coaches(id),
  reason text check (reason is null or length(reason) <= 500),
  status text not null default 'open' check (status in ('open', 'cancelled', 'done')),
  created_at timestamptz not null default now()
);

create unique index if not exists org_coach_removal_one_open
  on public.org_coach_removal_requests (org, coach)
  where status = 'open';

alter table public.org_coach_removal_requests enable row level security;

drop policy if exists "Owner reads their org removal requests" on public.org_coach_removal_requests;
create policy "Owner reads their org removal requests"
  on public.org_coach_removal_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.organizations o
      where o.id = org and o.owner_coach_id = public.current_coach_id()
    )
  );

drop policy if exists "Owner opens a removal request" on public.org_coach_removal_requests;
create policy "Owner opens a removal request"
  on public.org_coach_removal_requests
  for insert
  to authenticated
  with check (
    status = 'open'
    and requested_by = public.current_coach_id()
    and exists (
      select 1 from public.organizations o
      where o.id = org and o.owner_coach_id = public.current_coach_id()
    )
  );

drop policy if exists "Owner cancels their org removal requests" on public.org_coach_removal_requests;
create policy "Owner cancels their org removal requests"
  on public.org_coach_removal_requests
  for update
  to authenticated
  using (
    exists (
      select 1 from public.organizations o
      where o.id = org and o.owner_coach_id = public.current_coach_id()
    )
  )
  with check (
    status in ('open', 'cancelled')
    and exists (
      select 1 from public.organizations o
      where o.id = org and o.owner_coach_id = public.current_coach_id()
    )
  );

drop policy if exists "Admins manage all removal requests" on public.org_coach_removal_requests;
create policy "Admins manage all removal requests"
  on public.org_coach_removal_requests
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

revoke all on table public.org_coach_removal_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.org_coach_removal_requests to authenticated;

-- Owner: open a request for a coach in their org (not themselves). A second call returns the open row.
create or replace function public.request_org_coach_removal(p_coach_id uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.my_organization_id();
  v_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_org is null then
    raise exception 'Only organization owners can request a removal' using errcode = '42501';
  end if;
  if p_coach_id = public.current_coach_id() then
    raise exception 'You cannot request removal of yourself' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organization_coaches
    where organization_id = v_org and coach_id = p_coach_id and rate is not null
  ) then
    raise exception 'Coach not found in your organization' using errcode = '22023';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'Keep the reason under 500 characters' using errcode = '22023';
  end if;

  select id into v_id
  from public.org_coach_removal_requests
  where org = v_org and coach = p_coach_id and status = 'open';
  if v_id is not null then
    return v_id;
  end if;

  insert into public.org_coach_removal_requests (org, coach, requested_by, reason, status)
  values (v_org, p_coach_id, public.current_coach_id(), v_reason, 'open')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.cancel_org_coach_removal(p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.my_organization_id();
begin
  if v_org is null then
    raise exception 'Only organization owners can cancel a removal request' using errcode = '42501';
  end if;
  update public.org_coach_removal_requests
  set status = 'cancelled'
  where org = v_org and coach = p_coach_id and status = 'open';
  if not found then
    raise exception 'No open removal request for this coach' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.get_my_org_coach_removals()
returns table (id uuid, coach_id uuid, reason text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.coach, r.reason, r.created_at
  from public.org_coach_removal_requests r
  where r.org = public.my_organization_id() and r.status = 'open'
  order by r.created_at;
$$;

-- Close the old owner delete. Support removes the coach in the database and marks the request done.
create or replace function public.remove_organization_coach(p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Ask AthaNext to remove this coach. Removal is a support request, not a direct delete.'
    using errcode = '42501';
end;
$$;

revoke all on function public.request_org_coach_removal(uuid, text) from public, anon;
grant execute on function public.request_org_coach_removal(uuid, text) to authenticated;
revoke all on function public.cancel_org_coach_removal(uuid) from public, anon;
grant execute on function public.cancel_org_coach_removal(uuid) to authenticated;
revoke all on function public.get_my_org_coach_removals() from public, anon;
grant execute on function public.get_my_org_coach_removals() to authenticated;
