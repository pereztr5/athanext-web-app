-- ATH-57: Athlete ratings are final once submitted (replaces the ATH-45 one-edit allowance
-- for the athlete side only). Coach feedback keeps its one-edit rule.

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

    -- Athlete ratings are final once submitted (ATH-57).
    if v_athlete_update and v_existing_athlete_rated_at is not null then
      raise exception 'Ratings are final once submitted';
    end if;

    -- Coach feedback: initial submit does not consume the edit. A later rewrite does.

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

grant execute on function public.upsert_slot_feedback_v2(jsonb) to authenticated;
