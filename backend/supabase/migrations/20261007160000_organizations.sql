-- Organizations (ATH-90). An admin gives a coach org status; the owner invites coaches at an
-- agreed % rate, runs the org page families see and watches sessions across the org.
-- Org share is worked out on the session price (what families paid, after AthaNext fees).
-- The owner's own sessions stay 100% theirs. Rate changes wait for the coach to accept and
-- only apply to sessions booked after that, so every rate is kept with the date it started.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_coach_id uuid not null unique references public.coaches(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  slug text not null unique,
  line text not null default '' check (length(line) <= 120),
  about text not null default '' check (length(about) <= 280),
  logo_url text,
  pricing jsonb not null default '[]'::jsonb check (jsonb_typeof(pricing) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per coach in the org, the owner included (rate null = all theirs).
create table public.organization_coaches (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coach_id uuid not null unique references public.coaches(id) on delete cascade,
  rate numeric(5,2) check (rate between 0 and 100),
  shown boolean not null default true,
  sort_order integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (organization_id, coach_id)
);

-- Every rate a coach has agreed to, with when it started. Bookings use the rate in effect
-- when they were made.
create table public.organization_rate_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  rate numeric(5,2) not null check (rate between 0 and 100),
  effective_from timestamptz not null default now()
);
create index organization_rate_history_lookup on public.organization_rate_history (coach_id, effective_from desc);

-- Invites to join (kind 'join', by email) and rate changes waiting for the coach (kind 'rate').
create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null default 'join' check (kind in ('join', 'rate')),
  email text,
  coach_id uuid references public.coaches(id) on delete cascade,
  rate numeric(5,2) not null check (rate between 0 and 100),
  token uuid not null unique default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  check ((kind = 'join' and email is not null) or (kind = 'rate' and coach_id is not null))
);
create index organization_invites_org on public.organization_invites (organization_id) where status = 'pending';

alter table public.organizations enable row level security;
alter table public.organization_coaches enable row level security;
alter table public.organization_rate_history enable row level security;
alter table public.organization_invites enable row level security;

-- Reads only: the owner sees their org, coaches see their own membership, admins see all.
-- Every change goes through the functions below.
create policy "Owner and admins read organizations" on public.organizations for select to authenticated
  using (owner_coach_id = public.current_coach_id() or public.has_role(auth.uid(), 'admin'::app_role));
create policy "Owner, the coach and admins read org coaches" on public.organization_coaches for select to authenticated
  using (
    coach_id = public.current_coach_id()
    or exists (select 1 from public.organizations o where o.id = organization_id and o.owner_coach_id = public.current_coach_id())
    or public.has_role(auth.uid(), 'admin'::app_role)
  );
create policy "Owner and admins read org invites" on public.organization_invites for select to authenticated
  using (
    exists (select 1 from public.organizations o where o.id = organization_id and o.owner_coach_id = public.current_coach_id())
    or public.has_role(auth.uid(), 'admin'::app_role)
  );

create or replace function public.organization_slug(p_name text, p_org_id uuid default null)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_base text := btrim(regexp_replace(lower(btrim(p_name)), '[^[:alnum:]]+', '-', 'g'), '-');
  v_slug text;
  v_n integer := 1;
begin
  if v_base = '' then v_base := 'organization'; end if;
  v_slug := v_base;
  while exists (select 1 from public.organizations where slug = v_slug and id is distinct from p_org_id) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

create or replace function public.my_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.organizations where owner_coach_id = public.current_coach_id();
$$;

-- Admin: give or take away org status. Taking it away deletes the org, its page and invites;
-- coaches keep their own profiles, athletes and payments.
create or replace function public.admin_set_org_owner(p_coach_id uuid, p_enabled boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach public.coaches%rowtype;
  v_org uuid;
  v_name text;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'Only admins can change org status' using errcode = '42501';
  end if;
  select * into v_coach from public.coaches where id = p_coach_id;
  if not found then
    raise exception 'Coach not found' using errcode = '22023';
  end if;

  if not p_enabled then
    delete from public.organizations where owner_coach_id = p_coach_id;
    return null;
  end if;

  select id into v_org from public.organizations where owner_coach_id = p_coach_id;
  if v_org is not null then return v_org; end if;
  if exists (select 1 from public.organization_coaches where coach_id = p_coach_id) then
    raise exception 'This coach is already in another organization' using errcode = '22023';
  end if;

  v_name := left(coalesce(nullif(btrim(v_coach.company), ''), v_coach.name), 100);
  insert into public.organizations (owner_coach_id, name, slug, line)
  values (p_coach_id, v_name, public.organization_slug(v_name), coalesce(v_coach.locations[1], ''))
  returning id into v_org;
  insert into public.organization_coaches (organization_id, coach_id, rate, sort_order)
  values (v_org, p_coach_id, null, 0);
  return v_org;
end;
$$;

-- Admin Accounts: which coaches own an org.
create or replace function public.admin_org_owner_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select owner_coach_id from public.organizations
  where public.has_role(auth.uid(), 'admin'::app_role);
$$;

-- Owner: the org with its coaches and waiting invites, or null if this coach owns none.
create or replace function public.get_my_organization()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'slug', o.slug,
    'line', o.line,
    'about', o.about,
    'logo_url', o.logo_url,
    'pricing', o.pricing,
    'coaches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'coach_id', m.coach_id,
        'name', c.name,
        'slug', c.slug,
        'photo', coalesce(c.profile_image_url, c.image_url),
        'hourly_rate', c.hourly_rate,
        'is_owner', m.coach_id = o.owner_coach_id,
        'rate', m.rate,
        'pending_rate', (
          select i.rate from public.organization_invites i
          where i.organization_id = o.id and i.kind = 'rate' and i.coach_id = m.coach_id and i.status = 'pending'
          order by i.sent_at desc limit 1
        ),
        'shown', m.shown,
        'joined_at', m.joined_at,
        'pillars', coalesce((
          select jsonb_agg(distinct p.title)
          from public.coach_sport_pillars cp
          join public.sport_pillars p on p.id = cp.sport_pillar_id
          where cp.coach_id = m.coach_id and p.title is not null
        ), '[]'::jsonb)
      ) order by m.sort_order, m.joined_at)
      from public.organization_coaches m
      join public.coaches c on c.id = m.coach_id
      where m.organization_id = o.id
    ), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'rate', i.rate, 'sent_at', i.sent_at) order by i.sent_at desc)
      from public.organization_invites i
      where i.organization_id = o.id and i.kind = 'join' and i.status = 'pending'
    ), '[]'::jsonb)
  )
  from public.organizations o
  where o.owner_coach_id = public.current_coach_id();
$$;

-- Owner: sessions run by org coaches in a date range (up to 62 days), with what was paid and
-- the org share at the rate in effect when each booking was made. Read only: no scores and
-- nothing coaches wrote to families.
create or replace function public.get_organization_sessions(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.my_organization_id();
begin
  if v_org is null then
    raise exception 'Only organization owners can see this' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'Pick a range of up to 62 days' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(row_data order by (row_data->>'date') desc, (row_data->>'start_time') desc)
    from (
      select jsonb_build_object(
        'id', occ.id,
        'coach_id', occ.coach_id,
        'date', occ.occurrence_date,
        'start_time', occ.start_time,
        'end_time', occ.end_time,
        'session_type', occ.session_type,
        'session_name', occ.session_name,
        'pillar', occ.pillar_slot,
        'capacity', occ.max_bookings_per_slot,
        'price', occ.price,
        'athletes', count(b.id),
        'came', count(b.id) filter (where att.attendance = 'present'),
        'marked', bool_or(att.attendance is not null) or coalesce(bool_or(fb.no_show), false),
        'no_show', coalesce(bool_or(fb.no_show), false),
        'paid', coalesce(sum(occ.price) filter (where b.payment_status = 'paid'), 0),
        'to_org', coalesce(sum(
          case when m.rate is null then occ.price
          else occ.price * coalesce((
            select h.rate from public.organization_rate_history h
            where h.organization_id = v_org and h.coach_id = occ.coach_id and h.effective_from <= b.created_at
            order by h.effective_from desc limit 1
          ), m.rate) / 100 end
        ) filter (where b.payment_status = 'paid'), 0)
      ) as row_data
      from public.organization_coaches m
      join public.coach_availability_slot_occurrences occ on occ.coach_id = m.coach_id
      join public.coach_slot_bookings b on b.occurrence_id = occ.id and b.status in ('booked', 'completed', 'no_show')
      left join public.slot_attendance_v2 att on att.booking_id = b.id
      left join public.session_feedback_v2 fb on fb.slot_id = occ.id
      where m.organization_id = v_org
        and occ.occurrence_date between p_from and p_to
        and (m.rate is null or occ.occurrence_date >= (m.joined_at at time zone 'America/New_York')::date)
        and public.eastern_timestamp(occ.occurrence_date, occ.start_time) <= now()
      group by occ.id, m.rate
    ) s
  ), '[]'::jsonb);
end;
$$;

-- Owner: save the org page. p_coaches is the full ordered list [{coach_id, shown}].
create or replace function public.save_organization_page(
  p_name text, p_line text, p_about text, p_logo_url text, p_pricing jsonb, p_coaches jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.my_organization_id();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text;
  v_item jsonb;
  v_i integer := 0;
begin
  if v_org is null then
    raise exception 'Only the organization owner can edit this page' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'Add a name for the organization' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_pricing, '[]')) <> 'array' or jsonb_array_length(coalesce(p_pricing, '[]')) > 12 then
    raise exception 'Up to 12 pricing options' using errcode = '22023';
  end if;

  update public.organizations set
    name = left(v_name, 100),
    slug = case when name = left(v_name, 100) then slug else public.organization_slug(left(v_name, 100), v_org) end,
    line = left(btrim(coalesce(p_line, '')), 120),
    about = left(btrim(coalesce(p_about, '')), 280),
    logo_url = nullif(btrim(coalesce(p_logo_url, '')), ''),
    pricing = coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', left(btrim(item->>'name'), 80),
        'who', left(btrim(coalesce(item->>'who', '')), 120),
        'price', left(btrim(coalesce(item->>'price', '')), 40),
        'unit', left(btrim(coalesce(item->>'unit', '')), 40)
      ) order by ord)
      from jsonb_array_elements(coalesce(p_pricing, '[]')) with ordinality as t(item, ord)
      where btrim(coalesce(item->>'name', '')) <> ''
    ), '[]'::jsonb),
    updated_at = now()
  where id = v_org
  returning slug into v_slug;

  for v_item in select * from jsonb_array_elements(coalesce(p_coaches, '[]')) loop
    update public.organization_coaches
    set shown = coalesce((v_item->>'shown')::boolean, true), sort_order = v_i
    where organization_id = v_org and coach_id = (v_item->>'coach_id')::uuid;
    v_i := v_i + 1;
  end loop;
  return v_slug;
end;
$$;

-- Owner: invite a coach by email at an agreed rate. Returns the invite token for the link.
create or replace function public.invite_organization_coach(p_email text, p_rate numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.my_organization_id();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token uuid;
begin
  if v_org is null then
    raise exception 'Only organization owners can invite coaches' using errcode = '42501';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Add a valid email address' using errcode = '22023';
  end if;
  if p_rate is null or p_rate < 0 or p_rate > 100 then
    raise exception 'Pick a rate between 0 and 100' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.organization_coaches m join public.coaches c on c.id = m.coach_id
    where m.organization_id = v_org and lower(c.email) = v_email
  ) then
    raise exception 'This coach is already in your organization' using errcode = '22023';
  end if;

  update public.organization_invites set status = 'cancelled', responded_at = now()
  where organization_id = v_org and kind = 'join' and lower(email) = v_email and status = 'pending';
  insert into public.organization_invites (organization_id, kind, email, rate)
  values (v_org, 'join', v_email, round(p_rate, 2))
  returning token into v_token;
  return v_token;
end;
$$;

-- Owner: resend (fresh date, same token) or cancel a waiting invite.
create or replace function public.resend_organization_invite(p_invite_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  update public.organization_invites set sent_at = now()
  where id = p_invite_id and organization_id = public.my_organization_id() and status = 'pending'
  returning token;
$$;

create or replace function public.cancel_organization_invite(p_invite_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.organization_invites set status = 'cancelled', responded_at = now()
  where id = p_invite_id and organization_id = public.my_organization_id() and status = 'pending';
$$;

-- Owner: propose a new rate. It waits for the coach to accept. Returns the token for the link,
-- or null when the rate is the same as now (any waiting change is withdrawn).
create or replace function public.change_organization_rate(p_coach_id uuid, p_rate numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.my_organization_id();
  v_current numeric;
  v_token uuid;
begin
  if v_org is null then
    raise exception 'Only organization owners can change rates' using errcode = '42501';
  end if;
  if p_rate is null or p_rate < 0 or p_rate > 100 then
    raise exception 'Pick a rate between 0 and 100' using errcode = '22023';
  end if;
  select rate into v_current from public.organization_coaches
  where organization_id = v_org and coach_id = p_coach_id and rate is not null;
  if not found then
    raise exception 'Coach not found in your organization' using errcode = '22023';
  end if;

  update public.organization_invites set status = 'cancelled', responded_at = now()
  where organization_id = v_org and kind = 'rate' and coach_id = p_coach_id and status = 'pending';
  if round(p_rate, 2) = v_current then return null; end if;

  insert into public.organization_invites (organization_id, kind, coach_id, rate)
  values (v_org, 'rate', p_coach_id, round(p_rate, 2))
  returning token into v_token;
  return v_token;
end;
$$;

-- Owner: remove a coach. Splits stop for sessions booked from now on.
create or replace function public.remove_organization_coach(p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.my_organization_id();
begin
  if v_org is null then
    raise exception 'Only organization owners can remove coaches' using errcode = '42501';
  end if;
  delete from public.organization_coaches
  where organization_id = v_org and coach_id = p_coach_id and rate is not null;
  update public.organization_invites set status = 'cancelled', responded_at = now()
  where organization_id = v_org and kind = 'rate' and coach_id = p_coach_id and status = 'pending';
end;
$$;

-- The invited coach: what the invite says. Join invites are for the email they were sent to;
-- rate changes are for that coach.
create or replace function public.get_organization_invite(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inv public.organization_invites%rowtype;
  v_email text := lower((select email from auth.users where id = auth.uid()));
begin
  select * into v_inv from public.organization_invites where token = p_token;
  if not found or (v_inv.kind = 'join' and v_inv.email <> v_email)
     or (v_inv.kind = 'rate' and v_inv.coach_id is distinct from public.current_coach_id()) then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'kind', v_inv.kind,
      'status', v_inv.status,
      'rate', v_inv.rate,
      'current_rate', (select m.rate from public.organization_coaches m where m.organization_id = o.id and m.coach_id = v_inv.coach_id),
      'organization', o.name,
      'owner', c.name,
      'is_coach', public.current_coach_id() is not null,
      'in_other_org', exists (
        select 1 from public.organization_coaches m
        where m.coach_id = public.current_coach_id() and m.organization_id <> o.id
      )
    )
    from public.organizations o join public.coaches c on c.id = o.owner_coach_id
    where o.id = v_inv.organization_id
  );
end;
$$;

create or replace function public.respond_organization_invite(p_token uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.organization_invites%rowtype;
  v_coach uuid := public.current_coach_id();
  v_email text := lower((select email from auth.users where id = auth.uid()));
  v_next integer;
begin
  select * into v_inv from public.organization_invites where token = p_token for update;
  if not found or v_inv.status <> 'pending'
     or (v_inv.kind = 'join' and v_inv.email <> v_email)
     or (v_inv.kind = 'rate' and v_inv.coach_id is distinct from v_coach) then
    raise exception 'This invite is no longer open' using errcode = '22023';
  end if;

  if not p_accept then
    update public.organization_invites set status = 'declined', responded_at = now() where id = v_inv.id;
    return;
  end if;
  if v_coach is null then
    raise exception 'Sign in with your coach account to accept' using errcode = '42501';
  end if;

  if v_inv.kind = 'join' then
    if exists (select 1 from public.organization_coaches where coach_id = v_coach) then
      raise exception 'You are already in an organization' using errcode = '22023';
    end if;
    select coalesce(max(sort_order), 0) + 1 into v_next from public.organization_coaches where organization_id = v_inv.organization_id;
    insert into public.organization_coaches (organization_id, coach_id, rate, sort_order)
    values (v_inv.organization_id, v_coach, v_inv.rate, v_next);
  else
    update public.organization_coaches set rate = v_inv.rate
    where organization_id = v_inv.organization_id and coach_id = v_coach and rate is not null;
    if not found then
      raise exception 'You are no longer in this organization' using errcode = '22023';
    end if;
  end if;
  insert into public.organization_rate_history (organization_id, coach_id, rate) values (v_inv.organization_id, v_coach, v_inv.rate);
  update public.organization_invites set status = 'accepted', responded_at = now(), coach_id = v_coach where id = v_inv.id;
end;
$$;

-- Families: org pages and which listed coaches show on them, in the owner's order.
create or replace function public.get_organizations_public()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'slug', o.slug,
    'line', o.line,
    'about', o.about,
    'logo_url', o.logo_url,
    'pricing', o.pricing,
    'coach_ids', coalesce((
      select jsonb_agg(m.coach_id order by m.sort_order, m.joined_at)
      from public.organization_coaches m join public.coaches c on c.id = m.coach_id
      where m.organization_id = o.id and m.shown and c.listed and c.deactivated_at is null
    ), '[]'::jsonb),
    'member_ids', coalesce((
      select jsonb_agg(m.coach_id) from public.organization_coaches m where m.organization_id = o.id
    ), '[]'::jsonb)
  ) order by o.name), '[]'::jsonb)
  from public.organizations o;
$$;

revoke all on function public.organization_slug(text, uuid) from public, anon, authenticated;
revoke all on function public.my_organization_id() from public, anon;
grant execute on function public.my_organization_id() to authenticated;
revoke all on function public.admin_set_org_owner(uuid, boolean) from public, anon;
grant execute on function public.admin_set_org_owner(uuid, boolean) to authenticated;
revoke all on function public.admin_org_owner_ids() from public, anon;
grant execute on function public.admin_org_owner_ids() to authenticated;
revoke all on function public.get_my_organization() from public, anon;
grant execute on function public.get_my_organization() to authenticated;
revoke all on function public.get_organization_sessions(date, date) from public, anon;
grant execute on function public.get_organization_sessions(date, date) to authenticated;
revoke all on function public.save_organization_page(text, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.save_organization_page(text, text, text, text, jsonb, jsonb) to authenticated;
revoke all on function public.invite_organization_coach(text, numeric) from public, anon;
grant execute on function public.invite_organization_coach(text, numeric) to authenticated;
revoke all on function public.resend_organization_invite(uuid) from public, anon;
grant execute on function public.resend_organization_invite(uuid) to authenticated;
revoke all on function public.cancel_organization_invite(uuid) from public, anon;
grant execute on function public.cancel_organization_invite(uuid) to authenticated;
revoke all on function public.change_organization_rate(uuid, numeric) from public, anon;
grant execute on function public.change_organization_rate(uuid, numeric) to authenticated;
revoke all on function public.remove_organization_coach(uuid) from public, anon;
grant execute on function public.remove_organization_coach(uuid) to authenticated;
revoke all on function public.get_organization_invite(uuid) from public, anon;
grant execute on function public.get_organization_invite(uuid) to authenticated;
revoke all on function public.respond_organization_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_organization_invite(uuid, boolean) to authenticated;
grant execute on function public.get_organizations_public() to anon, authenticated;
