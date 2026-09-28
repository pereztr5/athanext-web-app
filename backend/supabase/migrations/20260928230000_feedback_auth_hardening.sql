-- ATH-45 follow-up: close the gaps around the feedback edit lock.
-- 1. upsert_session_feedback_v2 is security definer and never checked the caller.
-- 2. get_coach_session_feedback_screen_v2 returned coach_only_notes + athlete email for any slot.
-- 3. The edit lock lives in the RPCs, so direct table writes must not be possible.

create or replace function public.upsert_session_feedback_v2(
  p_slot_id uuid,
  p_rating integer,
  p_summary text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_coach_id uuid;
  v_existing_edit_count int;
begin
  select coach_id into v_coach_id
  from public.coach_availability_slot_occurrences
  where id = p_slot_id
  limit 1;

  if v_coach_id is null then
    raise exception 'No occurrence found for slot_id=%', p_slot_id;
  end if;

  if not exists (
    select 1
    from public.user_profiles as profile
    where profile.id = auth.uid()
      and profile.coach_id = v_coach_id
  ) then
    raise exception 'Only the coach for this session can write feedback' using errcode = '42501';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating out of range (1..5) for slot_id=%', p_slot_id
      using errcode = '23514';
  end if;

  -- Row lock so two concurrent saves cannot both pass the edit check.
  select edit_count
  into v_existing_edit_count
  from public.session_feedback_v2
  where slot_id = p_slot_id
  for update;

  if v_existing_edit_count is not null and v_existing_edit_count >= 1 then
    raise exception 'Feedback is locked after one edit';
  end if;

  insert into public.session_feedback_v2 (
    slot_id,
    coach_id,
    rating,
    summary,
    status,
    edit_count,
    updated_at
  )
  values (
    p_slot_id,
    v_coach_id,
    p_rating,
    p_summary,
    'submitted',
    0,
    now()
  )
  on conflict (slot_id)
  do update set
    rating = excluded.rating,
    summary = excluded.summary,
    edit_count = session_feedback_v2.edit_count + 1,
    updated_at = now();

  update public.coach_slot_bookings
  set
    status = 'completed',
    updated_at = now()
  where occurrence_id = p_slot_id
    and coach_id = v_coach_id
    and status = 'booked';
end;
$function$;

create or replace function public.get_coach_session_feedback_screen_v2(p_slot_id uuid)
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
  coach_rating_of_athlete integer,
  edit_count integer,
  coach_edit_count integer,
  session_edit_count integer
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
    f.coach_rating_of_athlete,
    coalesce(f.edit_count, 0) as edit_count,
    coalesce(f.coach_edit_count, 0) as coach_edit_count,
    coalesce(sf.edit_count, 0) as session_edit_count
  from public.coach_slot_bookings b
  join public.coach_availability_slot_occurrences occ on b.occurrence_id = occ.id
  join public.coaches c on occ.coach_id = c.id
  left join public.athlete_profiles ap on ap.id = b.athlete_id
  left join public.user_profiles u on u.id = b.athlete_id
  left join public.slot_attendance_v2 a on a.booking_id = b.id
  left join public.slot_feedback_v2 f on f.booking_id = b.id
  left join public.session_feedback_v2 sf on sf.slot_id = occ.id
  where occ.id = p_slot_id
    and (
      exists (
        select 1
        from public.user_profiles as profile
        where profile.id = auth.uid()
          and profile.coach_id = occ.coach_id
      )
      or public.has_role(auth.uid(), 'admin'::public.app_role)
    );
$function$;

-- All writes go through the security definer RPCs above; the app only reads these tables.
revoke insert, update, delete on public.slot_feedback_v2 from anon, authenticated;
revoke insert, update, delete on public.session_feedback_v2 from anon, authenticated;

revoke all on function public.upsert_session_feedback_v2(uuid, integer, text) from public, anon;
revoke all on function public.get_coach_session_feedback_screen_v2(uuid) from public, anon;
grant execute on function public.upsert_session_feedback_v2(uuid, integer, text) to authenticated;
grant execute on function public.get_coach_session_feedback_screen_v2(uuid) to authenticated;
