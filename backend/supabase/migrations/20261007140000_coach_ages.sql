-- Coach ages (ATH-95, ATH-96): the ages a coach works with. Families see "Ages 10 to 18"
-- on coach cards and under Good to know, and can filter by age group. age_max 99 means
-- "and up". Coaches set it in My Profile, Quick info.

alter table public.coaches
  add column if not exists age_min smallint check (age_min between 3 and 99),
  add column if not exists age_max smallint check (age_max between 3 and 99);

alter table public.coaches drop constraint if exists coaches_age_range;
alter table public.coaches
  add constraint coaches_age_range check (age_min is null or age_max is null or age_min <= age_max);

drop function if exists public.get_coaches_public();
create function public.get_coaches_public()
returns table(
  id uuid, name text, bio text, profile_image_url text, image_url text, company text,
  coach_position text, positions text[], locations text[], specialties text[], pathway_tags text[],
  zip_code text, languages text[], hourly_rate integer, rating numeric, total_reviews integer,
  years_experience integer, response_time_hours integer, session_types text[], availability jsonb,
  cancellation_policy text, instagram_handle text, status text, is_verified boolean,
  cover_image_urls text[], created_at timestamptz, updated_at timestamptz, sport_type text,
  favourite_positions text[], age_min smallint, age_max smallint
)
language sql
stable security definer
set search_path = public
as $$
  select c.id, c.name, c.bio, c.profile_image_url, c.image_url, c.company,
    c."position", c.positions, c.locations, c.specialties,
    coalesce(c.pathway_tags, '{}'::text[]), up.zip_code, c.languages,
    c.hourly_rate, c.rating, c.total_reviews, c.years_experience, c.response_time_hours,
    c.session_types, c.availability, c.cancellation_policy, c.instagram_handle,
    c.status, c.is_verified, c.cover_image_urls, c.created_at, c.updated_at,
    up.sport, c.favourite_positions, c.age_min, c.age_max
  from public.coaches c
  left join public.user_profiles up on c.id = up.coach_id
  where c.is_verified = true
    and coalesce(c.status, 'active') is distinct from 'hidden'
    and c.listed
    and c.deactivated_at is null;
$$;

grant execute on function public.get_coaches_public() to anon, authenticated;
