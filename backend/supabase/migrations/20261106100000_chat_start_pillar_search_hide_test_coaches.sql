-- Three fixes from Che Hee's testing (Oct 30):
-- 1. Messaging a coach: "Chat didn't open". Since 20261013120000 dropped the open "All RLS" policy,
--    the app creates a conversation and reads it back before anyone is a member, which the
--    member-only select policy refuses. The creator may now read the conversation they started.
-- 2. Book by pillar: coaches matched only on coach_sport_pillars, which 4 of 52 coaches have
--    filled in. Also match the pillars on their profile (specialties), skip coaches families
--    can't open (unverified, unlisted, deactivated, hidden), and filter by position only for
--    On-field training and Video analysis.
-- 3. Test coaches (user_profiles.is_test_account) no longer show in public coach lists, except
--    to test accounts, so the team can still test with them.

-- 1. Chat ---------------------------------------------------------------------------------
drop policy if exists conversations_select_participants on public.conversations;
create policy conversations_select_participants
  on public.conversations for select
  using (public.is_conversation_member(id) or created_by = auth.uid());

-- Shared rule for 2 and 3: a test coach shows only to test accounts.
create or replace function public.coach_visible_to_viewer(p_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
      select 1 from public.user_profiles up
      where up.coach_id = p_coach_id and up.is_test_account
    )
    or coalesce((select up.is_test_account from public.user_profiles up where up.id = auth.uid()), false);
$$;

grant execute on function public.coach_visible_to_viewer(uuid) to anon, authenticated;

-- 3. Coach directory ----------------------------------------------------------------------
create or replace function public.get_coaches_public()
 returns table(id uuid, name text, bio text, profile_image_url text, image_url text, company text, coach_position text, positions text[], locations text[], specialties text[], pathway_tags text[], zip_code text, languages text[], hourly_rate integer, rating numeric, total_reviews integer, years_experience integer, response_time_hours integer, session_types text[], availability jsonb, cancellation_policy text, instagram_handle text, status text, is_verified boolean, cover_image_urls text[], created_at timestamp with time zone, updated_at timestamp with time zone, sport_type text, favourite_positions text[], age_min smallint, age_max smallint, title text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select c.id, c.name, c.bio, c.profile_image_url, c.image_url, c.company,
    c."position", c.positions, c.locations, c.specialties,
    coalesce(c.pathway_tags, '{}'::text[]), up.zip_code, c.languages,
    c.hourly_rate, c.rating, c.total_reviews, c.years_experience, c.response_time_hours,
    c.session_types, c.availability, c.cancellation_policy, c.instagram_handle,
    c.status, c.is_verified, c.cover_image_urls, c.created_at, c.updated_at,
    up.sport, c.favourite_positions, c.age_min, c.age_max, c.title
  from public.coaches c
  left join public.user_profiles up on c.id = up.coach_id
  where c.is_verified = true
    and coalesce(c.status, 'active') is distinct from 'hidden'
    and c.listed
    and c.deactivated_at is null
    and public.coach_visible_to_viewer(c.id);
$function$;

-- 2. Book by pillar -----------------------------------------------------------------------
create or replace function public.get_pillar_coaches(p_pillar text, p_position text default null::text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with me as (select public.current_athlete_id() as athlete_id),
  today as (select (timezone('America/New_York', now()))::date as d),
  wanted as (
    select public.canonical_pillar(p_pillar) as pillar,
      -- Position only matters for work on the ball and film.
      case when public.canonical_pillar(p_pillar) in ('On-field training', 'Video analysis') then p_position end as position
  ),
  candidates as (
    select coach.id
    from public.coaches as coach, wanted
    where coalesce(coach.status, 'active') = 'active'
      and coach.is_verified
      and coach.listed
      and coach.deactivated_at is null
      and public.coach_visible_to_viewer(coach.id)
      and (
        exists (
          select 1 from public.coach_sport_pillars as link
          join public.sport_pillars as pillar on pillar.id = link.sport_pillar_id
          where link.coach_id = coach.id and pillar.sport = 'soccer' and pillar.title = wanted.pillar
        )
        -- The pillars coaches pick on their profile (soccer coaches; Book by pillar is soccer's).
        or (
          exists (select 1 from unnest(coalesce(coach.specialties, '{}')) as s where public.canonical_pillar(s) = wanted.pillar)
          and not exists (
            select 1 from public.user_profiles up
            where up.coach_id = coach.id and lower(coalesce(up.sport, '')) = 'rowing'
          )
        )
        or exists (
          select 1 from public.coach_availability_slot_occurrences as occ, today
          where occ.coach_id = coach.id and occ.is_enabled and not occ.is_draft
            and occ.pillar_slot = wanted.pillar
            and occ.occurrence_date between today.d and today.d + 28
        )
      )
      and (
        wanted.position is null
        or (wanted.position = 'Goalkeeper' and exists (
          select 1 from unnest(coalesce(coach.positions, '{}') || coalesce(coach.favourite_positions, '{}') || array[coalesce(coach.position, '')]) as pos
          where pos ilike '%keeper%'
        ))
        or (wanted.position = 'Field player' and (
          coalesce(array_length(coach.positions, 1), 0) = 0
          or exists (
            select 1 from unnest(coalesce(coach.positions, '{}') || coalesce(coach.favourite_positions, '{}')) as pos
            where pos <> '' and pos not ilike '%keeper%' and pos not ilike '%rower%' and pos not ilike '%coxswain%'
          )
        ))
      )
  ),
  sessions as (
    select s.*
    from candidates, me, today, wanted,
      lateral public.visible_sessions(candidates.id, me.athlete_id, today.d, today.d + 28) as s
    where s.my_status is null
      and (wanted.position is null or s.position is null or s.position in (wanted.position, 'Both'))
  )
  select coalesce(jsonb_agg(card order by (card->>'is_client')::boolean desc, (card->>'rating')::numeric desc nulls last, card->>'name'), '[]'::jsonb)
  from (
    select public.booking_coach_card(candidates.id, me.athlete_id) || jsonb_build_object(
      'next_open', (
        select jsonb_build_object('date', s.occurrence_date, 'start_time', s.start_time)
        from sessions as s
        where s.coach_id = candidates.id and s.session_type = 'individual' and s.booked_count = 0
        order by s.occurrence_date, s.start_time limit 1
      ),
      'next_group', (
        select jsonb_build_object('date', s.occurrence_date, 'start_time', s.start_time,
          'spots_left', s.capacity - s.booked_count, 'capacity', s.capacity, 'name', s.session_name)
        from sessions as s
        where s.coach_id = candidates.id and s.session_type = 'group' and s.booked_count < s.capacity
          and (s.pillar is null or s.pillar = public.canonical_pillar(p_pillar))
        order by s.occurrence_date, s.start_time limit 1
      ),
      'group_from', (
        select min(s.price) from sessions as s
        where s.coach_id = candidates.id and s.session_type = 'group' and s.booked_count < s.capacity
      ),
      'one_on_one_from', (
        select min(s.price) from sessions as s
        where s.coach_id = candidates.id and s.session_type = 'individual' and s.booked_count = 0
      )
    ) as card
    from candidates, me
  ) as cards;
$function$;
