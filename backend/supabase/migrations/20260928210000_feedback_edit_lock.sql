-- ATH-45: Allow one edit after initial submit, then lock feedback.
-- slot_feedback_v2 is shared by athlete + coach writers, so each side gets its own counter.
-- session_feedback_v2 is coach-only and uses a single edit_count.

alter table public.slot_feedback_v2
  add column if not exists edit_count int not null default 0,
  add column if not exists coach_edit_count int not null default 0;

do $$
begin
  if to_regclass('public.session_feedback_v2') is not null then
    alter table public.session_feedback_v2
      add column if not exists edit_count int not null default 0;
  end if;
end
$$;

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
  v_existing_athlete_rated_at timestamptz;
  v_existing_edit_count int;
  v_existing_coach_edit_count int;
  v_existing_has_coach_feedback boolean;
  v_increment_athlete_edit boolean;
  v_increment_coach_edit boolean;
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
    v_increment_athlete_edit := false;
    v_increment_coach_edit := false;
    v_existing_athlete_rated_at := null;
    v_existing_edit_count := 0;
    v_existing_coach_edit_count := 0;
    v_existing_has_coach_feedback := false;

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

    select
      athlete_rated_at,
      edit_count,
      coach_edit_count,
      (
        coach_rating_of_athlete is not null
        or nullif(btrim(coalesce(feedback_to_athlete, '')), '') is not null
        or nullif(btrim(coalesce(coach_only_notes, '')), '') is not null
      )
    into
      v_existing_athlete_rated_at,
      v_existing_edit_count,
      v_existing_coach_edit_count,
      v_existing_has_coach_feedback
    from public.slot_feedback_v2
    where booking_id = v_booking_id;

    -- Initial submit for a side does not consume the edit. A later rewrite does.
    if v_athlete_update and v_existing_athlete_rated_at is not null then
      if coalesce(v_existing_edit_count, 0) >= 1 then
        raise exception 'Feedback is locked after one edit';
      end if;
      v_increment_athlete_edit := true;
    end if;

    if v_coach_update and coalesce(v_existing_has_coach_feedback, false) then
      if coalesce(v_existing_coach_edit_count, 0) >= 1 then
        raise exception 'Feedback is locked after one edit';
      end if;
      v_increment_coach_edit := true;
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
      edit_count,
      coach_edit_count,
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
      0,
      0,
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
      edit_count = case
        when v_increment_athlete_edit then slot_feedback_v2.edit_count + 1
        else slot_feedback_v2.edit_count
      end,
      coach_edit_count = case
        when v_increment_coach_edit then slot_feedback_v2.coach_edit_count + 1
        else slot_feedback_v2.coach_edit_count
      end,
      updated_at = now();
  end loop;
end;
$function$;

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

  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating out of range (1..5) for slot_id=%', p_slot_id
      using errcode = '23514';
  end if;

  select edit_count
  into v_existing_edit_count
  from public.session_feedback_v2
  where slot_id = p_slot_id;

  if v_existing_edit_count is not null then
    if v_existing_edit_count >= 1 then
      raise exception 'Feedback is locked after one edit';
    end if;
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
  coach_rating_of_athlete,
  edit_count,
  coach_edit_count
) on public.slot_feedback_v2 to authenticated;

grant execute on function public.upsert_slot_feedback_v2(jsonb) to authenticated;
grant execute on function public.upsert_session_feedback_v2(uuid, integer, text) to authenticated;
grant execute on function public.get_coach_session_feedback_screen_v2(uuid) to authenticated;
