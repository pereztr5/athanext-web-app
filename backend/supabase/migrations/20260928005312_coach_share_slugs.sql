-- Public coach share links. The UUID stays the primary key; slug is the URL name.

alter table public.coaches
  add column if not exists slug text;

create table if not exists public.coach_slug_redirects (
  slug text primary key,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists coach_slug_redirects_coach_id_idx
  on public.coach_slug_redirects (coach_id);

create table if not exists public.coach_share_events (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  event_type text not null check (event_type in ('pricing_view', 'profile_share', 'pricing_copy', 'pricing_download')),
  created_at timestamptz not null default now()
);

create index if not exists coach_share_events_coach_id_created_at_idx
  on public.coach_share_events (coach_id, created_at desc);

create or replace function public.slugify_coach_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := lower(trim(coalesce(p_name, '')));
  v := translate(
    v,
    'àáâãäåāăąèéêëēĕėęěìíîïĩīĭįıòóôõöøōŏőùúûüũūŭůűųýÿĉçćčďñńňřśšţťźžż',
    'aaaaaaaaaeeeeeeeeiiiiiiiiiooooooooouuuuuuuuuyyccccdnnrsssttzzz'
  );
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := regexp_replace(v, '^-+|-+$', '', 'g');
  if length(v) < 3 then
    v := 'coach';
  end if;
  if length(v) > 60 then
    v := left(v, 60);
    v := regexp_replace(v, '-+$', '', 'g');
  end if;
  return v;
end;
$$;

create or replace function public.is_reserved_coach_slug(p_slug text)
returns boolean
language sql
immutable
as $$
  select lower(p_slug) in (
    'auth', 'admin', 'coaches', 'coach', 'dashboard', 'settings', 'profile',
    'availability', 'analytics', 'chat', 'contact', 'about', 'soccer', 'rowing',
    'partnerships', 'pricing', 'api', 'www', 'app', 'login', 'signup', 'sign-in',
    'sign-up', 'home', 'my-sessions', 'booking-confirmation', 'package-confirmation',
    'forgot-password', 'reset-password', 'become-a-coach', 'why-athalink',
    'privacy-policy', 'terms-and-conditions', 'signupconfirmation', 'athlete-profile'
  );
$$;

create or replace function public.allocate_coach_slug(p_name text, p_coach_id uuid default null)
returns text
language plpgsql
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix integer := 1;
begin
  v_base := public.slugify_coach_name(p_name);
  if public.is_reserved_coach_slug(v_base) then
    v_base := v_base || '-coach';
  end if;
  v_candidate := v_base;

  loop
    exit when not exists (
      select 1 from public.coaches c
      where c.slug = v_candidate
        and (p_coach_id is null or c.id is distinct from p_coach_id)
    )
    and not exists (
      select 1 from public.coach_slug_redirects r
      where r.slug = v_candidate
        and (p_coach_id is null or r.coach_id is distinct from p_coach_id)
    );

    v_suffix := v_suffix + 1;
    v_candidate := left(v_base, greatest(1, 60 - length(v_suffix::text) - 1)) || '-' || v_suffix::text;
  end loop;

  return v_candidate;
end;
$$;

-- Backfill missing slugs from the coach name.
do $$
declare
  rec record;
  v_slug text;
begin
  for rec in
    select id, name
    from public.coaches
    where slug is null or btrim(slug) = ''
    order by created_at, id
  loop
    v_slug := public.allocate_coach_slug(rec.name, rec.id);
    update public.coaches set slug = v_slug where id = rec.id;
  end loop;
end;
$$;

alter table public.coaches
  alter column slug set not null;

create unique index if not exists coaches_slug_key on public.coaches (slug);

create or replace function public.resolve_coach_by_slug_or_id(p_key text)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  if p_key is null or btrim(p_key) = '' then
    return null;
  end if;

  if p_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select c.id into v_id from public.coaches c where c.id = p_key::uuid;
    return v_id;
  end if;

  select c.id into v_id from public.coaches c where c.slug = lower(p_key);
  if v_id is not null then
    return v_id;
  end if;

  select r.coach_id into v_id from public.coach_slug_redirects r where r.slug = lower(p_key);
  return v_id;
end;
$$;

create or replace function public.rename_coach_slug(p_coach_id uuid, p_new_slug text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_slug text;
  v_old text;
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select up.id into v_owner
  from public.user_profiles up
  where up.coach_id = p_coach_id
    and up.id = auth.uid();

  if v_owner is null and not public.has_role(_user_id := auth.uid(), _role := 'admin') then
    raise exception 'Only the coach can change this link';
  end if;

  v_slug := public.slugify_coach_name(p_new_slug);
  if length(v_slug) < 3 or length(v_slug) > 60 then
    raise exception 'Link must be between 3 and 60 characters';
  end if;
  if public.is_reserved_coach_slug(v_slug) then
    raise exception 'That link is reserved';
  end if;
  if exists (
    select 1 from public.coaches c
    where c.slug = v_slug and c.id is distinct from p_coach_id
  ) or exists (
    select 1 from public.coach_slug_redirects r
    where r.slug = v_slug and r.coach_id is distinct from p_coach_id
  ) then
    raise exception 'That link is already taken';
  end if;

  select slug into v_old from public.coaches where id = p_coach_id for update;
  if v_old is null then
    raise exception 'Coach not found';
  end if;

  if v_old = v_slug then
    return v_slug;
  end if;

  insert into public.coach_slug_redirects (slug, coach_id)
  values (v_old, p_coach_id)
  on conflict (slug) do update set coach_id = excluded.coach_id;

  delete from public.coach_slug_redirects
  where slug = v_slug
    and coach_id = p_coach_id;

  update public.coaches
  set slug = v_slug, updated_at = now()
  where id = p_coach_id;

  return v_slug;
end;
$$;

create or replace function public.record_coach_share_event(p_coach_id uuid, p_event_type text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_event_type not in ('pricing_view', 'profile_share', 'pricing_copy', 'pricing_download') then
    raise exception 'Unknown share event';
  end if;
  if not exists (select 1 from public.coaches where id = p_coach_id) then
    raise exception 'Coach not found';
  end if;
  insert into public.coach_share_events (coach_id, event_type)
  values (p_coach_id, p_event_type);
end;
$$;

-- Keep new coaches from ending up without a slug.
create or replace function public.coaches_set_slug_on_insert()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.allocate_coach_slug(new.name, new.id);
  else
    new.slug := public.slugify_coach_name(new.slug);
    if public.is_reserved_coach_slug(new.slug)
       or exists (select 1 from public.coaches c where c.slug = new.slug and c.id is distinct from new.id)
       or exists (select 1 from public.coach_slug_redirects r where r.slug = new.slug) then
      new.slug := public.allocate_coach_slug(new.name, new.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists coaches_set_slug_on_insert on public.coaches;
create trigger coaches_set_slug_on_insert
  before insert on public.coaches
  for each row
  execute function public.coaches_set_slug_on_insert();

alter table public.coach_slug_redirects enable row level security;
alter table public.coach_share_events enable row level security;

drop policy if exists "Anyone can read coach slug redirects" on public.coach_slug_redirects;
create policy "Anyone can read coach slug redirects"
  on public.coach_slug_redirects
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Coach can read own share events" on public.coach_share_events;
create policy "Coach can read own share events"
  on public.coach_share_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.coach_id = coach_share_events.coach_id
    )
    or public.has_role(_user_id := auth.uid(), _role := 'admin')
  );

revoke all on function public.rename_coach_slug(uuid, text) from public, anon;
grant execute on function public.rename_coach_slug(uuid, text) to authenticated;

revoke all on function public.resolve_coach_by_slug_or_id(text) from public;
grant execute on function public.resolve_coach_by_slug_or_id(text) to anon, authenticated;

revoke all on function public.record_coach_share_event(uuid, text) from public;
grant execute on function public.record_coach_share_event(uuid, text) to anon, authenticated;

revoke all on function public.allocate_coach_slug(text, uuid) from public;
grant execute on function public.allocate_coach_slug(text, uuid) to authenticated;

revoke all on function public.slugify_coach_name(text) from public;
grant execute on function public.slugify_coach_name(text) to anon, authenticated;
