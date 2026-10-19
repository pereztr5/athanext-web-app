-- Camps are a kind of coach_packages row, not a second product table.
-- Families already read packages from coach_packages (RLS: "Packages are viewable by everyone"
-- where is_active). That select cannot show co-coach names or spots left, because
-- package_purchases is not readable across families. get_coach_public_packages is the
-- public catalog the profile uses for that: same visibility, plus co-coaches and
-- capacity minus paid purchases.
--
-- A camp registration must not become bookable session credits. Reconcile copies
-- sessions_total onto the purchase and treats 0 as 1, and package_purchases requires
-- sessions_total > 0. The purchase trigger keeps sessions_total at least 1 and sets
-- sessions_remaining to 0. Booking only spends remaining, so the row still counts as
-- a paid spot and the coach is still paid the list price.
--
-- The live camp baba5408-c67f-426b-85b7-d9226403206a (Thanksgiving High Performance Camp)
-- is marked kind = camp. Dates stay null until a coach enters them. The org package
-- High Performance Thanksgiving Camp is a different table and is not changed here.
-- Not applied in this change.

alter table public.coach_packages
  add column if not exists kind text not null default 'package',
  add column if not exists camp_starts_on date,
  add column if not exists camp_ends_on date,
  add column if not exists camp_daily_start time,
  add column if not exists camp_daily_end time,
  add column if not exists camp_location text,
  add column if not exists camp_capacity integer,
  add column if not exists camp_age_min integer,
  add column if not exists camp_age_max integer,
  add column if not exists co_coach_ids uuid[] not null default '{}';

alter table public.coach_packages drop constraint if exists coach_packages_kind_check;
alter table public.coach_packages
  add constraint coach_packages_kind_check check (kind in ('package', 'camp'));

alter table public.coach_packages drop constraint if exists coach_packages_camp_dates_check;
alter table public.coach_packages
  add constraint coach_packages_camp_dates_check
  check (camp_ends_on is null or camp_starts_on is null or camp_ends_on >= camp_starts_on);

alter table public.coach_packages drop constraint if exists coach_packages_camp_times_check;
alter table public.coach_packages
  add constraint coach_packages_camp_times_check
  check (camp_daily_end is null or camp_daily_start is null or camp_daily_end > camp_daily_start);

alter table public.coach_packages drop constraint if exists coach_packages_camp_ages_check;
alter table public.coach_packages
  add constraint coach_packages_camp_ages_check
  check (
    (camp_age_min is null or camp_age_min between 1 and 99)
    and (camp_age_max is null or camp_age_max between 1 and 99)
    and (camp_age_min is null or camp_age_max is null or camp_age_max >= camp_age_min)
  );

alter table public.coach_packages drop constraint if exists coach_packages_camp_capacity_check;
alter table public.coach_packages
  add constraint coach_packages_camp_capacity_check
  check (camp_capacity is null or camp_capacity >= 1);

alter table public.coach_packages drop constraint if exists coach_packages_camp_location_check;
alter table public.coach_packages
  add constraint coach_packages_camp_location_check
  check (camp_location is null or length(camp_location) <= 200);

comment on column public.coach_packages.kind is 'package or camp. Camps are one registration, not session credits.';
comment on column public.coach_packages.co_coach_ids is 'Other coaches on a camp. Empty for packages. Must share an organization with coach_id.';

-- Mark the live Thanksgiving camp. Leave its dates null.
update public.coach_packages
set kind = 'camp'
where id = 'baba5408-c67f-426b-85b7-d9226403206a'
  and kind is distinct from 'camp';

create or replace function public.coach_packages_validate_camp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if new.kind is null or btrim(new.kind) = '' then
    new.kind := 'package';
  end if;

  if new.kind = 'package' then
    new.co_coach_ids := '{}';
    return new;
  end if;

  if new.kind <> 'camp' then
    raise exception 'Package kind must be package or camp';
  end if;

  if new.camp_starts_on is not null and new.camp_ends_on is not null and new.camp_ends_on < new.camp_starts_on then
    raise exception 'Camp end date is before the start date';
  end if;

  if new.camp_daily_start is not null and new.camp_daily_end is not null and new.camp_daily_end <= new.camp_daily_start then
    raise exception 'Daily end time must be after the start time';
  end if;

  if new.camp_location is not null then
    new.camp_location := nullif(btrim(new.camp_location), '');
  end if;

  select coalesce(array_agg(distinct listed.coach_id), '{}'::uuid[])
    into new.co_coach_ids
  from unnest(coalesce(new.co_coach_ids, '{}'::uuid[])) as listed(coach_id);

  if new.coach_id = any(new.co_coach_ids) then
    raise exception 'You are already the coach for this camp';
  end if;

  foreach v_id in array new.co_coach_ids loop
    if not exists (
      select 1
      from public.organization_coaches as mine
      join public.organization_coaches as theirs
        on theirs.organization_id = mine.organization_id
      where mine.coach_id = new.coach_id
        and theirs.coach_id = v_id
    ) then
      raise exception 'Co-coaches must be coaches in your organization';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.coach_packages_validate_camp() from public;

drop trigger if exists coach_packages_validate_camp on public.coach_packages;
create trigger coach_packages_validate_camp
  before insert or update on public.coach_packages
  for each row execute function public.coach_packages_validate_camp();

-- Runs after the updated_at trigger. Booking spends sessions_remaining, which stays 0.
create or replace function public.camp_purchases_grant_no_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.package_id is not null and exists (
    select 1
    from public.coach_packages as pkg
    where pkg.id = new.package_id
      and pkg.kind = 'camp'
  ) then
    if new.sessions_total is null or new.sessions_total < 1 then
      new.sessions_total := 1;
    end if;
    new.sessions_remaining := 0;
  end if;
  return new;
end;
$$;

revoke all on function public.camp_purchases_grant_no_credits() from public;

drop trigger if exists zzz_camp_purchases_no_credits on public.package_purchases;
create trigger zzz_camp_purchases_no_credits
  before insert or update on public.package_purchases
  for each row execute function public.camp_purchases_grant_no_credits();

create or replace function public.get_coach_public_packages(p_coach_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(to_jsonb(src) order by src.created_at)
    from (
      select
        pkg.id,
        pkg.coach_id,
        pkg.package_name,
        pkg.description,
        pkg.session_count,
        pkg.duration_minutes,
        pkg.total_price,
        pkg.price_per_session,
        pkg.validity_days,
        pkg.is_active,
        pkg.kind,
        pkg.camp_starts_on,
        pkg.camp_ends_on,
        pkg.camp_daily_start,
        pkg.camp_daily_end,
        pkg.camp_location,
        pkg.camp_capacity,
        pkg.camp_age_min,
        pkg.camp_age_max,
        pkg.co_coach_ids,
        pkg.created_at,
        case
          when pkg.kind = 'camp' and pkg.camp_capacity is not null then greatest(
            0,
            pkg.camp_capacity - coalesce((
              select count(*)::integer
              from public.package_purchases as purchase
              where purchase.package_id = pkg.id
                and purchase.status in ('active', 'expired', 'completed')
            ), 0)
          )
          else null
        end as spots_left,
        case
          when pkg.kind = 'camp' then coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', mate.id,
              'name', mate.name,
              'photo_url', nullif(btrim(coalesce(mate.profile_image_url, mate.image_url, '')), '')
            ) order by mate.name)
            from public.coaches as mate
            where mate.id = any(pkg.co_coach_ids)
          ), '[]'::jsonb)
          else '[]'::jsonb
        end as co_coaches
      from public.coach_packages as pkg
      where p_coach_id is not null
        and pkg.coach_id = p_coach_id
        and (
          pkg.is_active
          or pkg.coach_id = (
            select profile.coach_id
            from public.user_profiles as profile
            where profile.id = auth.uid()
          )
        )
    ) as src
  ), '[]'::jsonb);
$$;

comment on function public.get_coach_public_packages(uuid) is
  'Public package catalog for a coach profile, including camps with co-coach names and spots left.';

revoke all on function public.get_coach_public_packages(uuid) from public;
grant execute on function public.get_coach_public_packages(uuid) to anon, authenticated;

create or replace function public.get_camp_teammates()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', mate.id,
      'name', mate.name,
      'photo_url', nullif(btrim(coalesce(mate.profile_image_url, mate.image_url, '')), '')
    ) order by mate.name)
    from public.coaches as mate
    where public.current_coach_id() is not null
      and mate.id <> public.current_coach_id()
      and exists (
        select 1
        from public.organization_coaches as mine
        join public.organization_coaches as theirs
          on theirs.organization_id = mine.organization_id
        where mine.coach_id = public.current_coach_id()
          and theirs.coach_id = mate.id
      )
  ), '[]'::jsonb);
$$;

comment on function public.get_camp_teammates() is
  'Other coaches in the signed-in coach''s organizations, for the camp co-coach picker.';

revoke all on function public.get_camp_teammates() from public;
grant execute on function public.get_camp_teammates() to authenticated;
