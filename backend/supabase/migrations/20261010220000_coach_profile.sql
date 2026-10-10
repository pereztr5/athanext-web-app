-- Coach's own profile matching the Working Copy (c-profile, view and Edit profile).
--
-- 1. coaches gains coaching_video_url (the "Coaching video" completeness step) and
--    profile_services: the session types listed under "Sessions and pricing". Each entry is
--    { id, name, format: 'individual'|'group', minutes, where, price (dollars), on }. The entry
--    with id 'individual' is the base 1-on-1 row; its price always comes from hourly_rate, so
--    only its name, length, place and on/off are read from here.
-- 2. slot_feedback_v2 (the reviews the app shows) gains coach_reply and coach_reply_at, so a
--    coach can answer a review once. set_review_reply saves it for a review of the caller.
-- 3. get_coach_reviews_public returns coach_reply, coach_reply_at and athlete_age (age when the
--    review was left; the app shows "Parent of a U16 athlete" or "Athlete, 18+"). The return
--    type changes, so the function is dropped and created again with the same grants.
-- 4. get_coach_profile_extras: what the profile needs that get_coaches_public doesn't return:
--    video link, visible session types, the most booked package, the coach's academy and, for
--    the coach themselves only, whether they have upcoming open times.
-- 5. set_coach_coaching_video and set_coach_profile_services save the new columns for the
--    calling coach.

alter table public.coaches
  add column if not exists coaching_video_url text,
  add column if not exists profile_services jsonb not null default '[]'::jsonb;

alter table public.coaches drop constraint if exists coaches_coaching_video_url_check;
alter table public.coaches
  add constraint coaches_coaching_video_url_check
  check (coaching_video_url is null or (length(coaching_video_url) <= 500 and coaching_video_url ~* '(youtube\.com|youtu\.be|vimeo\.com)/'));
alter table public.coaches drop constraint if exists coaches_profile_services_check;
alter table public.coaches
  add constraint coaches_profile_services_check
  check (jsonb_typeof(profile_services) = 'array' and jsonb_array_length(profile_services) <= 20);

comment on column public.coaches.coaching_video_url is 'YouTube or Vimeo link to a short clip of the coach coaching (My Profile). Null = not added.';
comment on column public.coaches.profile_services is 'Session types shown on the profile: [{id,name,format,minutes,where,price,on}]. id ''individual'' takes its price from hourly_rate.';

alter table public.slot_feedback_v2
  add column if not exists coach_reply text,
  add column if not exists coach_reply_at timestamptz;

alter table public.slot_feedback_v2 drop constraint if exists slot_feedback_v2_coach_reply_length;
alter table public.slot_feedback_v2
  add constraint slot_feedback_v2_coach_reply_length check (coach_reply is null or length(coach_reply) <= 1000);

comment on column public.slot_feedback_v2.coach_reply is 'The coach''s public reply to this review. One per review.';
comment on column public.slot_feedback_v2.coach_reply_at is 'When coach_reply was posted.';

drop function if exists public.get_coach_reviews_public(uuid);

create function public.get_coach_reviews_public(coach_uuid uuid default null)
returns table(
  id uuid,
  coach_id uuid,
  rating integer,
  review_text text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  reviewer_name text,
  coach_reply text,
  coach_reply_at timestamp with time zone,
  athlete_age integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    feedback.id,
    feedback.coach_id,
    feedback.rating::integer,
    feedback.comment as review_text,
    feedback.created_at,
    feedback.updated_at,
    coalesce(athlete.full_name, 'Athlete') as reviewer_name,
    feedback.coach_reply,
    feedback.coach_reply_at,
    case
      when athlete.date_of_birth is null then null
      else extract(year from age(feedback.created_at::date, athlete.date_of_birth::date))::integer
    end as athlete_age
  from public.slot_feedback_v2 as feedback
  left join public.athlete_profiles as athlete on athlete.id = feedback.athlete_id
  where feedback.athlete_rated_at is not null
    and feedback.rating is not null
    and feedback.comment is not null
    and btrim(feedback.comment) <> ''
    and (coach_uuid is null or feedback.coach_id = coach_uuid)
  order by feedback.created_at desc;
$function$;

grant execute on function public.get_coach_reviews_public(uuid) to anon, authenticated;

create or replace function public.set_review_reply(p_review_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
begin
  if v_coach is null then
    raise exception 'Only coaches can reply to reviews';
  end if;
  if v_reply is not null and length(v_reply) > 1000 then
    raise exception 'Keep your reply under 1000 characters';
  end if;

  update public.slot_feedback_v2
  set coach_reply = v_reply,
      coach_reply_at = case when v_reply is null then null else now() end
  where id = p_review_id
    and coach_id = v_coach
    and athlete_rated_at is not null;

  if not found then
    raise exception 'Review not found';
  end if;
end;
$$;

revoke all on function public.set_review_reply(uuid, text) from public, anon;
grant execute on function public.set_review_reply(uuid, text) to authenticated;

create or replace function public.get_coach_profile_extras(p_coach_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'coaching_video_url', coach.coaching_video_url,
    -- Families only see session types that are switched on; the coach sees all of them.
    'services', case
      when coach.id = public.current_coach_id() then coach.profile_services
      else coalesce((
        select jsonb_agg(s) from jsonb_array_elements(coach.profile_services) as s
        where coalesce((s->>'on')::boolean, true)
      ), '[]'::jsonb)
    end,
    -- "Most booked": the active package with the most purchases, once there are 2 or more.
    'most_booked_package_id', (
      select purchase.package_id
      from public.package_purchases as purchase
      join public.coach_packages as pkg on pkg.id = purchase.package_id and pkg.is_active
      where purchase.coach_id = coach.id
        and purchase.status not in ('pending', 'failed', 'refunded', 'cancelled', 'canceled')
      group by purchase.package_id
      having count(*) >= 2
      order by count(*) desc, max(purchase.created_at) desc
      limit 1
    ),
    'organization', (
      select jsonb_build_object('name', org.name, 'slug', org.slug, 'is_owner', org.owner_coach_id = coach.id)
      from public.organization_coaches as member
      join public.organizations as org on org.id = member.organization_id
      where member.coach_id = coach.id
      order by (org.owner_coach_id = coach.id) desc, member.joined_at
      limit 1
    ),
    'has_availability', case
      when coach.id = public.current_coach_id() then exists (
        select 1 from public.coach_availability_slot_occurrences as occ
        where occ.coach_id = coach.id
          and occ.occurrence_date >= current_date
          and occ.is_enabled
          and not occ.is_draft
      )
      else null
    end
  )
  from public.coaches as coach
  where coach.id = p_coach_id;
$$;

revoke all on function public.get_coach_profile_extras(uuid) from public;
grant execute on function public.get_coach_profile_extras(uuid) to anon, authenticated;

create or replace function public.set_coach_coaching_video(p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if v_coach is null then
    raise exception 'Only coaches can add a coaching video';
  end if;
  if v_url is not null and v_url !~* '(youtube\.com|youtu\.be|vimeo\.com)/' then
    raise exception 'Paste a YouTube or Vimeo link';
  end if;
  update public.coaches set coaching_video_url = v_url, updated_at = now() where id = v_coach;
end;
$$;

revoke all on function public.set_coach_coaching_video(text) from public, anon;
grant execute on function public.set_coach_coaching_video(text) to authenticated;

create or replace function public.set_coach_profile_services(p_services jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.current_coach_id();
  v_item jsonb;
begin
  if v_coach is null then
    raise exception 'Only coaches can edit session types';
  end if;
  if p_services is null or jsonb_typeof(p_services) <> 'array' then
    raise exception 'Session types must be a list';
  end if;
  if jsonb_array_length(p_services) > 20 then
    raise exception 'Up to 20 session types';
  end if;
  for v_item in select * from jsonb_array_elements(p_services) loop
    if coalesce(btrim(v_item->>'id'), '') = '' or coalesce(btrim(v_item->>'name'), '') = '' then
      raise exception 'Each session type needs a name';
    end if;
    if coalesce(v_item->>'format', '') not in ('individual', 'group') then
      raise exception 'Session format must be individual or group';
    end if;
    if coalesce((v_item->>'minutes')::integer, 0) not between 15 and 480 then
      raise exception 'Session length must be 15 to 480 minutes';
    end if;
    if v_item->>'id' <> 'individual' and coalesce((v_item->>'price')::numeric, -1) not between 0 and 10000 then
      raise exception 'Price must be 0 to 10000';
    end if;
  end loop;
  update public.coaches set profile_services = p_services, updated_at = now() where id = v_coach;
end;
$$;

revoke all on function public.set_coach_profile_services(jsonb) from public, anon;
grant execute on function public.set_coach_profile_services(jsonb) to authenticated;
