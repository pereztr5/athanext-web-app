-- ATH-87: coach Account Settings.
-- listed: the coach's own "Show my profile on the marketplace" switch. Separate from
--   coaches.status, which admins use to hide a coach.
-- deactivated_at: the coach deactivated their account. They leave the marketplace and
--   families can't book them; they can still add walk-ins to sessions they already have.
-- user_profiles.notification_prefs: {"<kind>_<email|app>": false} turns one off. Anything
--   missing is on. Senders check notification_allowed().

alter table public.coaches
  add column if not exists listed boolean not null default true,
  add column if not exists deactivated_at timestamptz;

alter table public.user_profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

create or replace function public.get_coaches_public()
returns table(
  id uuid, name text, bio text, profile_image_url text, image_url text, company text,
  coach_position text, positions text[], locations text[], specialties text[], pathway_tags text[],
  zip_code text, languages text[], hourly_rate integer, rating numeric, total_reviews integer,
  years_experience integer, response_time_hours integer, session_types text[], availability jsonb,
  cancellation_policy text, instagram_handle text, status text, is_verified boolean,
  cover_image_urls text[], created_at timestamptz, updated_at timestamptz, sport_type text,
  favourite_positions text[]
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
    up.sport, c.favourite_positions
  from public.coaches c
  left join public.user_profiles up on c.id = up.coach_id
  where c.is_verified = true
    and coalesce(c.status, 'active') is distinct from 'hidden'
    and c.listed
    and c.deactivated_at is null;
$$;

-- New bookings for a deactivated coach are refused, except ones the coach adds themselves.
create or replace function public.refuse_bookings_for_deactivated_coach()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.coaches where id = new.coach_id and deactivated_at is not null)
     and new.coach_id is distinct from public.current_coach_id() then
    raise exception 'This coach isn''t taking bookings right now' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists refuse_bookings_for_deactivated_coach on public.coach_slot_bookings;
create trigger refuse_bookings_for_deactivated_coach
  before insert on public.coach_slot_bookings
  for each row execute function public.refuse_bookings_for_deactivated_coach();

create or replace function public.notification_allowed(p_user_id uuid, p_kind text, p_channel text)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select coalesce((
    select (up.notification_prefs ->> (p_kind || '_' || p_channel))::boolean
    from public.user_profiles up where up.id = p_user_id
  ), true);
$$;

revoke all on function public.notification_allowed(uuid, text, text) from public, anon, authenticated;
