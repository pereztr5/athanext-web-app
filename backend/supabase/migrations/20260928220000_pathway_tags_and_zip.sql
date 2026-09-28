-- Pathway tags for coaches and athletes + zip on public coach list (ATH-13/24/14).

alter table public.coaches
  add column if not exists pathway_tags text[] not null default '{}';

alter table public.athlete_profiles
  add column if not exists pathway_tags text[] not null default '{}';

create index if not exists coaches_pathway_tags_gin
  on public.coaches using gin (pathway_tags);

create index if not exists athlete_profiles_pathway_tags_gin
  on public.athlete_profiles using gin (pathway_tags);

-- Recreate public coach list to expose pathway_tags and zip_code.
drop function if exists public.get_coaches_public();

create function public.get_coaches_public()
returns table(
  id uuid,
  name text,
  bio text,
  profile_image_url text,
  image_url text,
  company text,
  coach_position text,
  positions text[],
  locations text[],
  specialties text[],
  pathway_tags text[],
  zip_code text,
  languages text[],
  hourly_rate integer,
  rating numeric,
  total_reviews integer,
  years_experience integer,
  response_time_hours integer,
  session_types text[],
  availability jsonb,
  cancellation_policy text,
  instagram_handle text,
  status text,
  is_verified boolean,
  cover_image_urls text[],
  created_at timestamptz,
  updated_at timestamptz,
  sport_type text,
  favourite_positions text[]
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    c.id,
    c.name,
    c.bio,
    c.profile_image_url,
    c.image_url,
    c.company,
    c."position" as coach_position,
    c.positions,
    c.locations,
    c.specialties,
    coalesce(c.pathway_tags, '{}'::text[]) as pathway_tags,
    up.zip_code,
    c.languages,
    c.hourly_rate,
    c.rating,
    c.total_reviews,
    c.years_experience,
    c.response_time_hours,
    c.session_types,
    c.availability,
    c.cancellation_policy,
    c.instagram_handle,
    c.status,
    c.is_verified,
    c.cover_image_urls,
    c.created_at,
    c.updated_at,
    up.sport as sport_type,
    c.favourite_positions
  from public.coaches c
  left join public.user_profiles up on c.id = up.coach_id
  where c.is_verified = true
    and coalesce(c.status, 'active') is distinct from 'hidden';
$$;

grant execute on function public.get_coaches_public() to anon, authenticated;
