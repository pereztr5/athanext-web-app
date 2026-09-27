-- Athlete ratings of a coach stay on slot_feedback_v2.rating.
-- A coach's rating of an athlete is stored separately and does not affect the public score.
-- coach_only_notes stay off the columns an athlete can select.

alter table public.slot_feedback_v2
  add column if not exists athlete_rated_at timestamptz,
  add column if not exists coach_rating_of_athlete smallint;

alter table public.slot_feedback_v2
  drop constraint if exists slot_feedback_v2_coach_rating_range;

alter table public.slot_feedback_v2
  add constraint slot_feedback_v2_coach_rating_range
  check (coach_rating_of_athlete is null or coach_rating_of_athlete between 1 and 5);

-- Rows with an athlete comment, or a rating and no coach note, are athlete ratings.
update public.slot_feedback_v2
set athlete_rated_at = coalesce(updated_at, created_at)
where rating is not null
  and athlete_rated_at is null
  and comment is not null
  and btrim(comment) <> '';

update public.slot_feedback_v2
set athlete_rated_at = coalesce(updated_at, created_at)
where rating is not null
  and athlete_rated_at is null
  and feedback_to_athlete is null
  and coalesce(btrim(coach_only_notes), '') = '';

-- A leftover rating on a coach-written row is the coach's rating of the athlete.
update public.slot_feedback_v2
set coach_rating_of_athlete = rating,
    rating = null
where rating is not null
  and athlete_rated_at is null;

update public.coaches as coach
set
  total_reviews = stats.total_reviews,
  rating = case when stats.total_reviews >= 3 then stats.average_rating else null end
from (
  select
    coaches.id,
    count(feedback.id) filter (
      where feedback.athlete_rated_at is not null and feedback.rating is not null
    )::int as total_reviews,
    round(avg(feedback.rating) filter (
      where feedback.athlete_rated_at is not null and feedback.rating is not null
    )::numeric, 2) as average_rating
  from public.coaches as coaches
  left join public.slot_feedback_v2 as feedback on feedback.coach_id = coaches.id
  group by coaches.id
) as stats
where coach.id = stats.id;

create or replace function public.upsert_slot_feedback_v2(p_feedback_records jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rec jsonb;
  v_booking_id uuid;
  v_slot_id uuid;
  v_athlete_id uuid;
  v_coach_id uuid;
  v_rating int;
  v_comment text;
  v_highlighted_skills text[];
  v_feedback_to_athlete text;
  v_coach_only_notes text;
  v_coach_rating int;
  v_athlete_update boolean;
  v_coach_update boolean;
begin
  for rec in select * from jsonb_array_elements(p_feedback_records)
  loop
    v_booking_id := nullif(rec->>'booking_id', '')::uuid;
    v_slot_id := nullif(rec->>'slot_id', '')::uuid;
    v_athlete_id := nullif(rec->>'athlete_id', '')::uuid;
    v_coach_id := nullif(rec->>'coach_id', '')::uuid;
    v_rating := nullif(rec->>'rating', '')::int;
    v_comment := rec->>'comment';
    v_feedback_to_athlete := nullif(btrim(coalesce(rec->>'feedback_to_athlete', '')), '');
    v_coach_only_notes := nullif(btrim(coalesce(rec->>'coach_only_notes', '')), '');
    v_coach_rating := nullif(rec->>'coach_rating_of_athlete', '')::int;
    v_athlete_update := rec ? 'comment';
    v_coach_update := rec ? 'feedback_to_athlete'
      or rec ? 'coach_only_notes'
      or rec ? 'coach_rating_of_athlete';

    if v_booking_id is null or v_athlete_id is null then
      raise exception 'booking_id and athlete_id are required';
    end if;

    if not exists (
      select 1
      from public.coach_slot_bookings
      where id = v_booking_id
        and athlete_id = v_athlete_id
    ) then
      raise exception 'Booking does not match this athlete' using errcode = '42501';
    end if;

    if v_athlete_update then
      if v_rating is null or v_rating < 1 or v_rating > 5 then
        raise exception 'rating out of range (1..5) for booking_id=%', v_booking_id
          using errcode = '23514';
      end if;
      if not exists (
        select 1
        from public.athlete_profiles
        where id = v_athlete_id
          and user_id = auth.uid()
      ) then
        raise exception 'Only the athlete on this booking can rate the coach' using errcode = '42501';
      end if;
    end if;

    if v_coach_update then
      if v_coach_rating is not null and (v_coach_rating < 1 or v_coach_rating > 5) then
        raise exception 'coach rating out of range (1..5) for booking_id=%', v_booking_id
          using errcode = '23514';
      end if;
      if not exists (
        select 1
        from public.coach_slot_bookings as booking
        join public.user_profiles as profile on profile.coach_id = booking.coach_id
        where booking.id = v_booking_id
          and profile.id = auth.uid()
      ) then
        raise exception 'Only the coach for this session can write feedback' using errcode = '42501';
      end if;
    end if;

    if not v_athlete_update and not v_coach_update then
      raise exception 'Feedback payload must include an athlete rating or a coach note';
    end if;

    if rec ? 'highlighted_skills' and jsonb_typeof(rec->'highlighted_skills') = 'array' then
      v_highlighted_skills := array(select jsonb_array_elements_text(rec->'highlighted_skills'));
    else
      v_highlighted_skills := null;
    end if;

    insert into public.slot_feedback_v2 (
      booking_id,
      slot_id,
      athlete_id,
      coach_id,
      rating,
      comment,
      highlighted_skills,
      feedback_to_athlete,
      coach_only_notes,
      coach_rating_of_athlete,
      athlete_rated_at,
      updated_at
    )
    values (
      v_booking_id,
      v_slot_id,
      v_athlete_id,
      v_coach_id,
      case when v_athlete_update then v_rating else null end,
      case when v_athlete_update then nullif(btrim(coalesce(v_comment, '')), '') else null end,
      v_highlighted_skills,
      case when rec ? 'feedback_to_athlete' then v_feedback_to_athlete else null end,
      case when rec ? 'coach_only_notes' then v_coach_only_notes else null end,
      case when rec ? 'coach_rating_of_athlete' then v_coach_rating else null end,
      case when v_athlete_update then now() else null end,
      now()
    )
    on conflict (booking_id)
    do update set
      slot_id = coalesce(excluded.slot_id, slot_feedback_v2.slot_id),
      athlete_id = coalesce(excluded.athlete_id, slot_feedback_v2.athlete_id),
      coach_id = coalesce(excluded.coach_id, slot_feedback_v2.coach_id),
      rating = case when v_athlete_update then excluded.rating else slot_feedback_v2.rating end,
      comment = case when v_athlete_update then excluded.comment else slot_feedback_v2.comment end,
      athlete_rated_at = case when v_athlete_update then now() else slot_feedback_v2.athlete_rated_at end,
      highlighted_skills = coalesce(excluded.highlighted_skills, slot_feedback_v2.highlighted_skills),
      feedback_to_athlete = case
        when rec ? 'feedback_to_athlete' then excluded.feedback_to_athlete
        else slot_feedback_v2.feedback_to_athlete
      end,
      coach_only_notes = case
        when rec ? 'coach_only_notes' then excluded.coach_only_notes
        else slot_feedback_v2.coach_only_notes
      end,
      coach_rating_of_athlete = case
        when rec ? 'coach_rating_of_athlete' then excluded.coach_rating_of_athlete
        else slot_feedback_v2.coach_rating_of_athlete
      end,
      updated_at = now();
  end loop;
end;
$function$;

create or replace function public.get_coach_rating_stats(p_coach_id uuid)
returns table(
  average_rating numeric,
  total_reviews integer,
  five_star integer,
  four_star integer,
  three_star integer,
  two_star integer,
  one_star integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_average numeric := 0;
  v_total integer := 0;
  v_five integer := 0;
  v_four integer := 0;
  v_three integer := 0;
  v_two integer := 0;
  v_one integer := 0;
begin
  select
    coalesce(round(avg(rating)::numeric, 2), 0)::numeric,
    count(*)::int,
    count(*) filter (where rating = 5)::int,
    count(*) filter (where rating = 4)::int,
    count(*) filter (where rating = 3)::int,
    count(*) filter (where rating = 2)::int,
    count(*) filter (where rating = 1)::int
  into
    v_average,
    v_total,
    v_five,
    v_four,
    v_three,
    v_two,
    v_one
  from public.slot_feedback_v2
  where coach_id = p_coach_id
    and athlete_rated_at is not null
    and rating is not null;

  update public.coaches
  set
    rating = case when v_total >= 3 then v_average else null end,
    total_reviews = v_total
  where id = p_coach_id;

  return query
  select
    v_average as average_rating,
    v_total as total_reviews,
    v_five as five_star,
    v_four as four_star,
    v_three as three_star,
    v_two as two_star,
    v_one as one_star;
end;
$function$;

create or replace function public.get_coach_reviews_public(coach_uuid uuid default null)
returns table(
  id uuid,
  coach_id uuid,
  rating integer,
  review_text text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  reviewer_name text
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
    coalesce(athlete.full_name, 'Athlete') as reviewer_name
  from public.slot_feedback_v2 as feedback
  left join public.athlete_profiles as athlete on athlete.id = feedback.athlete_id
  where feedback.athlete_rated_at is not null
    and feedback.rating is not null
    and feedback.comment is not null
    and btrim(feedback.comment) <> ''
    and (coach_uuid is null or feedback.coach_id = coach_uuid)
  order by feedback.created_at desc;
$function$;

drop function if exists public.get_coach_session_feedback_screen_v2(uuid);

create function public.get_coach_session_feedback_screen_v2(p_slot_id uuid)
returns table(
  booking_id uuid,
  slot_id uuid,
  availability_id uuid,
  coach_id uuid,
  athlete_id uuid,
  athlete_name text,
  athlete_email text,
  athlete_position text,
  athlete_age text,
  athlete_level text,
  athlete_avatar text,
  athlete_bio text,
  athlete_interests text[],
  athlete_hometown text,
  athlete_school text,
  athlete_goals text,
  attendance text,
  reason_absent text,
  rating integer,
  highlighted_skills text[],
  feedback_to_athlete text,
  coach_only_notes text,
  session_rating integer,
  session_summary text,
  coach_notes text,
  slot_session_name text,
  slot_location text,
  slot_price numeric,
  pillar_slot text,
  session_date date,
  slot_start_time time without time zone,
  slot_end_time time without time zone,
  comment text,
  coach_rating_of_athlete integer
)
language sql
security definer
set search_path to 'public'
as $function$
  select
    b.id as booking_id,
    occ.id as slot_id,
    occ.availability_id,
    occ.coach_id,
    b.athlete_id,
    ap.full_name as athlete_name,
    u.email as athlete_email,
    ap.position as athlete_position,
    case
      when ap.date_of_birth is not null then (extract(year from age(ap.date_of_birth)))::text || ' yrs'
      else null
    end as athlete_age,
    ap.current_year as athlete_level,
    ap.profile_image_url as athlete_avatar,
    ap.bio as athlete_bio,
    ap.tags as athlete_interests,
    ap.location as athlete_hometown,
    ap.high_school as athlete_school,
    null::text as athlete_goals,
    a.attendance,
    a.reason_absent,
    f.rating,
    f.highlighted_skills,
    f.feedback_to_athlete,
    f.coach_only_notes,
    sf.rating as session_rating,
    sf.summary as session_summary,
    null::text as coach_notes,
    occ.session_name as slot_session_name,
    occ.location as slot_location,
    occ.price as slot_price,
    occ.pillar_slot,
    occ.occurrence_date as session_date,
    occ.start_time as slot_start_time,
    occ.end_time as slot_end_time,
    f.comment,
    f.coach_rating_of_athlete
  from public.coach_slot_bookings b
  join public.coach_availability_slot_occurrences occ on b.occurrence_id = occ.id
  join public.coaches c on occ.coach_id = c.id
  left join public.athlete_profiles ap on ap.id = b.athlete_id
  left join public.user_profiles u on u.id = b.athlete_id
  left join public.slot_attendance_v2 a on a.booking_id = b.id
  left join public.slot_feedback_v2 f on f.booking_id = b.id
  left join public.session_feedback_v2 sf on sf.slot_id = occ.id
  where occ.id = p_slot_id;
$function$;

revoke select on public.slot_feedback_v2 from anon, authenticated;
grant select (
  id,
  booking_id,
  slot_id,
  athlete_id,
  coach_id,
  rating,
  comment,
  feedback_to_athlete,
  highlighted_skills,
  skills,
  coach_notes,
  status,
  created_by,
  created_at,
  updated_at,
  athlete_rated_at,
  coach_rating_of_athlete
) on public.slot_feedback_v2 to authenticated;

grant execute on function public.upsert_slot_feedback_v2(jsonb) to authenticated;
grant execute on function public.get_coach_rating_stats(uuid) to anon, authenticated;
grant execute on function public.get_coach_reviews_public(uuid) to anon, authenticated;
grant execute on function public.get_coach_session_feedback_screen_v2(uuid) to authenticated;
