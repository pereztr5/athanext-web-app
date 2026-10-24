-- Camp registrations show up everywhere sessions do (Oct 26).
--
-- Camp sign-ups lived only in camp_registrations, so camp days had no bookings: no roster, no
-- attendance or roll-call feedback, nothing on Home, My Sessions or the family's sessions.
-- Now every active registration (held or paid) with a linked athlete holds one
-- coach_slot_bookings row per camp day of its group:
--   status 'booked', payment_status 'camp', camp_registration_id = the registration.
-- 'camp' is not a session payment: every refund, credit, payout, receipt, booking email,
-- earnings and unpaid-checkout path filters on other payment_status values ('paid', 'credit',
-- 'direct', 'outside', 'pending_offline', 'unpaid', 'requires_action'), so none of them touch
-- these rows. Camp money stays on camp_registrations / the camp purchase.
--
-- sync_camp_registration_bookings(registration) keeps the rows in step. It runs from a trigger
-- on camp_registrations (insert, and updates of status, group_id, athlete_id, user_id), so
-- sign-up, mark paid, coach-added athletes, claim_camp_registrations() (linking the athlete),
-- expiry, coach cancel and card refunds all follow without changing those functions; and after
-- camp_sync_schedule() rebuilds the camp's sessions (save, publish, unpublish).
--   * active: one booked row per camp day that hasn't ended (enabled, not cancelled);
--   * inactive (cancelled, expired, pending_payment, no athlete or group): upcoming rows are
--     cancelled ('Camp registration cancelled'), no credit, no refund, no email;
--   * group or day changes: upcoming rows that no longer fit are deleted, or cancelled when they
--     already have attendance, feedback or an issue report. Past days are never rewritten.
-- Idempotent. A failing sync is logged, never raised, so a payment or sign-up is never lost.
--
-- Function bodies below are the live definitions with only these changes:
--   camp_block_session_booking         lets the matching camp rows in; family self-booking of a
--                                      camp day is still refused.
--   refuse_bookings_for_deactivated_coach  skips camp rows (the registration already exists).
--   camp_occurrence_has_history        camp rows alone are not history, so a rebuilt camp still
--                                      deletes an untouched day (its camp rows go with it).
--   camp_sync_schedule                 re-syncs the camp's registrations after the rebuild.
--   cancel_my_booking                  families can't cancel a single camp day.
--   get_coach_session, get_athlete_session  add a 'camp' object (name, day, group).
--   get_athlete_home                   the next session reads "Camp · <name> · Day N".
-- Backfill at the end for registrations that are already active.

alter table public.coach_slot_bookings
  add column if not exists camp_registration_id uuid references public.camp_registrations(id) on delete cascade;

-- One row per registration and camp day; also the index for camp_registration_id lookups.
alter table public.coach_slot_bookings drop constraint if exists coach_slot_bookings_camp_registration_day;
alter table public.coach_slot_bookings add constraint coach_slot_bookings_camp_registration_day
  unique (camp_registration_id, occurrence_id);

alter table public.coach_slot_bookings drop constraint if exists bookings_v3_payment_status;
alter table public.coach_slot_bookings add constraint bookings_v3_payment_status
  check (payment_status = any (array['unpaid'::text, 'requires_action'::text, 'paid'::text, 'refunded'::text, 'direct'::text,
    'pending_offline'::text, 'credit'::text, 'authorized'::text, 'released'::text, 'outside'::text, 'disputed'::text, 'camp'::text]));

-- 'camp' only on camp rows, and camp rows only as 'camp': no session payment path can pick them up.
alter table public.coach_slot_bookings drop constraint if exists coach_slot_bookings_camp_payment;
alter table public.coach_slot_bookings add constraint coach_slot_bookings_camp_payment
  check ((payment_status = 'camp') = (camp_registration_id is not null));

create or replace function public.sync_camp_registration_bookings(p_registration_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reg public.camp_registrations%rowtype;
  v_active boolean;
  v_n integer := 0;
  v_m integer;
begin
  select * into v_reg from public.camp_registrations where id = p_registration_id;
  if not found then
    return 0;
  end if;
  v_active := v_reg.status in ('held', 'paid') and v_reg.athlete_id is not null and v_reg.group_id is not null;

  -- Inactive: upcoming camp days are cancelled. No credit, no refund, no email.
  if not v_active then
    update public.coach_slot_bookings as b
      set status = 'canceled', canceled_at = now(), updated_at = now(),
          cancellation_reason = 'Camp registration cancelled'
      from public.coach_availability_slot_occurrences as occ
      where b.camp_registration_id = v_reg.id
        and b.status = 'booked'
        and occ.id = b.occurrence_id
        and public.eastern_timestamp(occ.occurrence_date, occ.end_time) > now();
    get diagnostics v_n = row_count;
    return v_n;
  end if;

  -- Upcoming rows that no longer fit: another athlete, another group, a day that was removed or
  -- cancelled. Deleted, or cancelled when something already hangs off them.
  with stale as (
    select b.id,
      exists (select 1 from public.slot_attendance_v2 as a where a.booking_id = b.id)
        or exists (select 1 from public.slot_feedback_v2 as f where f.booking_id = b.id)
        or exists (select 1 from public.session_issue_reports as r where r.booking_id = b.id) as has_history
    from public.coach_slot_bookings as b
    join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
    where b.camp_registration_id = v_reg.id
      and b.status = 'booked'
      and public.eastern_timestamp(occ.occurrence_date, occ.end_time) > now()
      and (
        b.athlete_id is distinct from v_reg.athlete_id
        or occ.camp_id is distinct from v_reg.camp_id
        or occ.camp_group_id is distinct from v_reg.group_id
        or not occ.is_enabled
        or occ.canceled_at is not null
      )
  ), dropped as (
    delete from public.coach_slot_bookings as b
    using stale
    where b.id = stale.id and not stale.has_history
    returning b.id
  ), closed as (
    update public.coach_slot_bookings as b
      set status = 'canceled', canceled_at = now(), updated_at = now(),
          cancellation_reason = 'Camp registration changed'
      from stale
      where b.id = stale.id and stale.has_history
      returning b.id
  )
  select (select count(*) from dropped) + (select count(*) from closed) into v_n;

  -- One booked row per camp day of the group that hasn't ended. A day this sync cancelled before
  -- (registration cancelled, then paid again) comes back; other cancelled rows stay as they are.
  insert into public.coach_slot_bookings as b (
    occurrence_id, coach_id, athlete_id, status, payment_status, camp_registration_id, created_by
  )
  select occ.id, occ.coach_id, v_reg.athlete_id, 'booked', 'camp', v_reg.id, v_reg.user_id
  from public.coach_availability_slot_occurrences as occ
  where occ.camp_id = v_reg.camp_id
    and occ.camp_group_id = v_reg.group_id
    and occ.is_enabled
    and occ.canceled_at is null
    and public.eastern_timestamp(occ.occurrence_date, occ.end_time) > now()
  on conflict (camp_registration_id, occurrence_id) do update
    set status = 'booked', canceled_at = null, cancellation_reason = null, updated_at = now(),
        created_by = coalesce(excluded.created_by, b.created_by)
    where (b.status = 'canceled' and b.cancellation_reason = 'Camp registration cancelled'
           and b.athlete_id = excluded.athlete_id)
       or (b.status = 'booked' and excluded.created_by is not null and b.created_by is distinct from excluded.created_by);
  get diagnostics v_m = row_count;
  return v_n + v_m;
end;
$function$;

revoke all on function public.sync_camp_registration_bookings(uuid) from public, anon, authenticated;
grant execute on function public.sync_camp_registration_bookings(uuid) to service_role;

create or replace function public.camp_registration_sync_bookings()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.group_id is not distinct from old.group_id
     and new.athlete_id is not distinct from old.athlete_id
     and new.user_id is not distinct from old.user_id then
    return null;
  end if;
  begin
    perform public.sync_camp_registration_bookings(new.id);
  exception when others then
    raise warning 'camp_registration_sync_bookings %: %', new.id, sqlerrm;
  end;
  return null;
end;
$function$;

revoke all on function public.camp_registration_sync_bookings() from public, anon, authenticated;

drop trigger if exists camp_registration_sync_bookings on public.camp_registrations;
create trigger camp_registration_sync_bookings
  after insert or update of status, group_id, athlete_id, user_id on public.camp_registrations
  for each row execute function public.camp_registration_sync_bookings();

CREATE OR REPLACE FUNCTION public.camp_block_session_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Camp rows from sync_camp_registration_bookings: the registration's own athlete, camp and group.
  if new.camp_registration_id is not null and new.payment_status = 'camp' and exists (
    select 1
    from public.camp_registrations as reg
    join public.coach_availability_slot_occurrences as occ on occ.id = new.occurrence_id
    where reg.id = new.camp_registration_id
      and reg.status in ('held', 'paid')
      and reg.athlete_id = new.athlete_id
      and occ.camp_id = reg.camp_id
      and occ.camp_group_id = reg.group_id
  ) then
    return new;
  end if;
  if new.occurrence_id is not null and exists (
    select 1 from public.coach_availability_slot_occurrences
    where id = new.occurrence_id and camp_id is not null
  ) then
    raise exception 'Camp days are joined through the camp sign-up, not booked one by one'
      using errcode = '22023', hint = 'camp_day';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.refuse_bookings_for_deactivated_coach()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Camp rows follow a registration that already exists.
  if new.camp_registration_id is not null then
    return new;
  end if;
  if exists (select 1 from public.coaches where id = new.coach_id and deactivated_at is not null)
     and new.coach_id is distinct from public.current_coach_id() then
    raise exception 'This coach isn''t taking bookings right now' using errcode = '22023';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.camp_occurrence_has_history(p_occurrence_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.slot_attendance_v2 where slot_id = p_occurrence_id)
    or exists (select 1 from public.slot_feedback_v2 where slot_id = p_occurrence_id)
    or exists (select 1 from public.session_feedback_v2 where slot_id = p_occurrence_id)
    or exists (select 1 from public.session_scores where slot_id = p_occurrence_id)
    or exists (select 1 from public.coach_slot_bookings where occurrence_id = p_occurrence_id and camp_registration_id is null)
    or exists (select 1 from public.payments where slot_id = p_occurrence_id);
$function$;

CREATE OR REPLACE FUNCTION public.camp_sync_schedule(p_camp_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_camp public.coach_packages%rowtype;
  v_group public.camp_groups%rowtype;
  v_today date := public.camp_today();
  v_day date;
  v_days integer;
  v_groups integer;
  v_occ uuid;
  v_live boolean;
  v_n integer := 0;
begin
  select * into v_camp from public.coach_packages where id = p_camp_id and kind = 'camp';
  if not found then
    return 0;
  end if;
  v_live := v_camp.is_active and v_camp.camp_published_at is not null
    and v_camp.camp_starts_on is not null and v_camp.camp_ends_on is not null;

  for v_occ in
    select occ.id
    from public.coach_availability_slot_occurrences as occ
    where occ.camp_id = p_camp_id
      and occ.occurrence_date >= v_today
      and (
        not v_live
        or occ.camp_group_id is null
        or occ.occurrence_date not between v_camp.camp_starts_on and v_camp.camp_ends_on
        or not exists (select 1 from public.camp_groups as g where g.id = occ.camp_group_id and g.camp_id = p_camp_id)
      )
  loop
    perform public.camp_drop_occurrence(v_occ);
  end loop;

  if not v_live then
    perform public.sync_camp_registration_bookings(reg.id)
    from public.camp_registrations as reg
    where reg.camp_id = p_camp_id and reg.status in ('held', 'paid');
    return 0;
  end if;

  v_days := v_camp.camp_ends_on - v_camp.camp_starts_on + 1;
  select count(*) into v_groups from public.camp_groups where camp_id = p_camp_id;

  for v_group in select * from public.camp_groups where camp_id = p_camp_id order by sort_order, created_at loop
    for v_day in
      select d::date from generate_series(greatest(v_camp.camp_starts_on, v_today), v_camp.camp_ends_on, interval '1 day') as d
    loop
      begin
        insert into public.coach_availability_slot_occurrences as occ (
          coach_id, occurrence_date, session_name, price, duration_minutes, start_time, end_time,
          session_type, location, place, visibility, offered_to, details, is_draft, is_enabled,
          max_bookings_per_slot, camp_id, camp_group_id, camp_day_index
        ) values (
          v_camp.coach_id, v_day,
          left(v_camp.package_name || case when v_groups > 1 then ' · ' || v_group.name else '' end, 160),
          round(v_camp.total_price / 100.0, 2),
          (extract(epoch from (v_group.end_time - v_group.start_time)) / 60)::integer,
          v_group.start_time, v_group.end_time,
          -- 'offered' to nobody: no family list shows it even where camp_id isn't checked.
          'group', 'in-person', v_camp.camp_location, 'offered', '{}',
          jsonb_build_object(
            'camp_id', v_camp.id, 'camp_group_id', v_group.id,
            'day_index', v_day - v_camp.camp_starts_on + 1, 'days_total', v_days
          ),
          false, true, v_group.spots, v_camp.id, v_group.id, (v_day - v_camp.camp_starts_on + 1)::smallint
        )
        on conflict (camp_group_id, occurrence_date) where camp_group_id is not null do update
          set session_name = excluded.session_name,
              price = excluded.price,
              duration_minutes = excluded.duration_minutes,
              start_time = excluded.start_time,
              end_time = excluded.end_time,
              place = excluded.place,
              visibility = 'offered',
              offered_to = '{}',
              details = excluded.details,
              is_draft = false,
              is_enabled = true,
              disabled_reason = null,
              max_bookings_per_slot = excluded.max_bookings_per_slot,
              camp_id = excluded.camp_id,
              camp_day_index = excluded.camp_day_index;
      exception when raise_exception then
        raise exception 'You already have a session on % that overlaps % (% to %). Move it, then try again.',
          to_char(v_day, 'Mon FMDD'), v_group.name, to_char(v_group.start_time, 'FMHH12:MI AM'),
          to_char(v_group.end_time, 'FMHH12:MI AM')
          using errcode = '23P01', hint = 'schedule_clash';
      end;
      v_n := v_n + 1;
    end loop;
  end loop;
  -- Camp rosters follow the rebuilt days.
  perform public.sync_camp_registration_bookings(reg.id)
  from public.camp_registrations as reg
  where reg.camp_id = p_camp_id and reg.status in ('held', 'paid');
  return v_n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_my_booking(p_booking_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_booking public.coach_slot_bookings%rowtype;
  v_starts timestamptz;
  v_user uuid;
  v_credit boolean := false;
  v_notice integer;
begin
  select b.* into v_booking
  from public.coach_slot_bookings b
  join public.athlete_profiles a on a.id = b.athlete_id
  where b.id = p_booking_id and (a.user_id = auth.uid() or b.created_by = auth.uid())
  for update of b;
  if not found then
    raise exception 'Booking not found' using errcode = '42501';
  end if;
  if v_booking.camp_registration_id is not null then
    raise exception 'Camp sessions are managed by your coach' using errcode = '22023', hint = 'camp_day';
  end if;
  if v_booking.status not in ('booked', 'pending_payment', 'requested') then
    raise exception 'This session can no longer be cancelled' using errcode = '22023';
  end if;
  select public.eastern_timestamp(occ.occurrence_date, occ.start_time) into v_starts
  from public.coach_availability_slot_occurrences occ where occ.id = v_booking.occurrence_id;
  if v_starts <= now() then
    raise exception 'This session has already started' using errcode = '22023';
  end if;

  select coalesce(c.cancel_notice_hours, 24) into v_notice
  from public.coaches c where c.id = v_booking.coach_id;
  v_notice := greatest(1, least(coalesce(v_notice, 24), 168));

  if v_booking.status = 'booked' and v_booking.payment_status in ('paid', 'credit')
     and v_starts - now() >= make_interval(hours => v_notice) then
    select user_id into v_user from public.athlete_profiles where id = v_booking.athlete_id;
    if v_booking.payment_status = 'credit' and exists (
      select 1 from public.package_purchases
      where id = v_booking.credit_purchase_id and status = 'active' and (expiry_date is null or expiry_date > now())
    ) then
      update public.package_purchases set sessions_remaining = least(sessions_total, sessions_remaining + 1), updated_at = now()
      where id = v_booking.credit_purchase_id;
    else
      insert into public.package_purchases (
        coach_id, user_id, package_id, source, source_booking_id, sessions_total, sessions_remaining,
        status, purchase_date, expiry_date, total_amount
      ) values (
        v_booking.coach_id, v_user, null, 'cancel_credit', v_booking.id, 1, 1,
        'active', now(), now() + interval '90 days', 0
      );
    end if;
    v_credit := true;
    perform public.void_booking_transfers(v_booking.id);
  elsif v_booking.status = 'booked' and v_booking.payment_status in ('paid', 'credit') then
    -- Late cancel: family keeps the charge; coach is still paid once the hold releases.
    perform public.release_booking_transfers(v_booking.id);
  else
    perform public.void_booking_transfers(v_booking.id);
  end if;

  update public.coach_slot_bookings
  set status = 'canceled', canceled_at = now(), updated_at = now(),
      cancellation_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Cancelled by the family')
  where id = p_booking_id;
  return jsonb_build_object('credit', v_credit);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_coach_session(p_occurrence_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_coach uuid := public.current_coach_id();
  v_occ public.coach_availability_slot_occurrences;
  v_starts timestamptz;
  v_first_athlete uuid;
begin
  select * into v_occ from public.coach_availability_slot_occurrences where id = p_occurrence_id and coach_id = v_coach;
  if v_occ.id is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  v_starts := public.eastern_timestamp(v_occ.occurrence_date, v_occ.start_time);

  select booking.athlete_id into v_first_athlete
  from public.coach_slot_bookings as booking
  where booking.occurrence_id = v_occ.id and booking.status in ('requested', 'pending_payment', 'booked', 'completed', 'no_show')
  order by booking.created_at limit 1;

  return jsonb_build_object(
    'id', v_occ.id,
    'date', v_occ.occurrence_date,
    'start_time', v_occ.start_time,
    'end_time', v_occ.end_time,
    'duration_minutes', v_occ.duration_minutes,
    'session_type', v_occ.session_type,
    'session_name', v_occ.session_name,
    'pillar', v_occ.pillar_slot,
    'price', v_occ.price,
    'capacity', v_occ.max_bookings_per_slot,
    'location', v_occ.location,
    'place', v_occ.place,
    'is_enabled', v_occ.is_enabled,
    'series_id', v_occ.series_id,
    'camp', case when v_occ.camp_id is null then null else (
      select jsonb_build_object(
        'id', camp.id,
        'name', camp.package_name,
        'slug', camp.camp_slug,
        'day_index', v_occ.camp_day_index,
        'days_total', camp.camp_ends_on - camp.camp_starts_on + 1,
        'group_name', grp.name
      )
      from public.coach_packages as camp
      left join public.camp_groups as grp on grp.id = v_occ.camp_group_id
      where camp.id = v_occ.camp_id
    ) end,
    'started', v_starts <= now(),
    'ended', public.eastern_timestamp(v_occ.occurrence_date, v_occ.end_time) <= now(),
    'cancel', case
      when v_occ.canceled_at is not null then jsonb_build_object(
        'at', v_occ.canceled_at, 'reason', v_occ.cancel_reason, 'refund', v_occ.cancel_refund)
      when not v_occ.is_enabled then (
        select jsonb_build_object('at', max(b.canceled_at), 'reason', null, 'refund', null)
        from public.coach_slot_bookings b
        where b.occurrence_id = v_occ.id and b.cancellation_reason like 'Cancelled by coach%'
        having count(*) > 0
      )
    end,
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', booking.id,
        'athlete_id', booking.athlete_id,
        'name', coalesce(athlete.full_name, 'Athlete'),
        'image_url', athlete.profile_image_url,
        'status', booking.status,
        'payment_status', booking.payment_status,
        'attendance', attendance.attendance,
        'notes', booking.notes,
        'cancellation_reason', booking.cancellation_reason,
        'canceled_at', booking.canceled_at,
        'age', extract(year from age((now() at time zone 'America/New_York')::date, athlete.date_of_birth))::int,
        'parent_name', (
          select up.name from public.user_profiles up
          where (up.athlete_id = athlete.id or up.id = athlete.user_id)
            and up.persona_type = 'parent' and coalesce(up.name, '') <> '' and up.name <> athlete.full_name
          limit 1
        ),
        'credits_left', public.coach_credits_left(v_coach, booking.athlete_id),
        'paid_amount', (select sum(p.total_amount) from public.payments p where p.booking_id = booking.id),
        'note', (select nullif(n.feedback_to_athlete, '') from public.slot_feedback_v2 n where n.booking_id = booking.id),
        -- A cancelled paid or credit booking came back as a credit (coach cancel, or 24 hours' notice).
        'credit_back', booking.status = 'canceled' and booking.payment_status in ('paid', 'credit') and (
          booking.cancellation_reason like 'Cancelled by coach%'
          or exists (select 1 from public.package_purchases pp where pp.source_booking_id = booking.id)
          or booking.canceled_at <= v_starts - interval '24 hours'
        )
      ) order by booking.created_at)
      from public.coach_slot_bookings as booking
      left join public.athlete_profiles as athlete on athlete.id = booking.athlete_id
      left join public.slot_attendance_v2 as attendance on attendance.booking_id = booking.id
      where booking.occurrence_id = v_occ.id
        and booking.status in ('requested', 'pending_payment', 'booked', 'completed', 'no_show', 'canceled')
    ), '[]'::jsonb),
    'feedback', (
      select jsonb_build_object(
        'summary', feedback.summary,
        'no_show', feedback.no_show,
        'edit_count', feedback.edit_count,
        'score', (select score.score from public.session_scores as score where score.slot_id = v_occ.id)
      )
      from public.session_feedback_v2 as feedback where feedback.slot_id = v_occ.id
    ),
    'last_summary', case when v_occ.session_type = 'individual' and v_first_athlete is not null then (
      select jsonb_build_object('date', prev.occurrence_date, 'summary', feedback.summary)
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as prev on prev.id = booking.occurrence_id
      join public.session_feedback_v2 as feedback on feedback.slot_id = prev.id
      where booking.coach_id = v_coach and booking.athlete_id = v_first_athlete
        and prev.id <> v_occ.id and not feedback.no_show and feedback.summary is not null
        and (prev.occurrence_date, prev.start_time) < (v_occ.occurrence_date, v_occ.start_time)
      order by prev.occurrence_date desc, prev.start_time desc
      limit 1
    ) end,
    -- What to work on next: the note for the athlete from the previous session, else its summary.
    'last_focus', case when v_occ.session_type = 'individual' and v_first_athlete is not null then (
      select jsonb_build_object('date', prev.occurrence_date, 'text', coalesce(nullif(note.feedback_to_athlete, ''), feedback.summary))
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as prev on prev.id = booking.occurrence_id
      left join public.session_feedback_v2 as feedback on feedback.slot_id = prev.id and not feedback.no_show
      left join public.slot_feedback_v2 as note on note.booking_id = booking.id
      where booking.coach_id = v_coach and booking.athlete_id = v_first_athlete
        and prev.id <> v_occ.id
        and coalesce(nullif(note.feedback_to_athlete, ''), feedback.summary) is not null
        and (prev.occurrence_date, prev.start_time) < (v_occ.occurrence_date, v_occ.start_time)
      order by prev.occurrence_date desc, prev.start_time desc
      limit 1
    ) end
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_athlete_session(p_occurrence_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_athlete uuid := public.current_athlete_id();
  v_occ public.coach_availability_slot_occurrences;
  v_booking public.coach_slot_bookings;
  v_attendance public.attendance_status;
  v_missed boolean;
begin
  if v_athlete is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  select * into v_booking from public.coach_slot_bookings
  where occurrence_id = p_occurrence_id and athlete_id = v_athlete
  order by case when status = 'canceled' then 1 else 0 end, created_at desc
  limit 1;
  if v_booking.id is null then
    raise exception 'Session not found' using errcode = '42501';
  end if;
  select * into v_occ from public.coach_availability_slot_occurrences where id = p_occurrence_id;
  select a.attendance into v_attendance from public.slot_attendance_v2 as a where a.booking_id = v_booking.id;
  -- Marked as missed: with the flag on, the family gets the short missed message, not the summary.
  v_missed := public.feedback_missed_gets_short_message() and coalesce(v_attendance::text, 'present') <> 'present';

  return jsonb_build_object(
    'id', v_occ.id,
    'date', v_occ.occurrence_date,
    'start_time', v_occ.start_time,
    'end_time', v_occ.end_time,
    'duration_minutes', v_occ.duration_minutes,
    'session_type', v_occ.session_type,
    'session_name', v_occ.session_name,
    'pillar', v_occ.pillar_slot,
    'price', v_occ.price,
    'location', v_occ.location,
    'place', v_occ.place,
    'started', public.eastern_timestamp(v_occ.occurrence_date, v_occ.start_time) <= now(),
    'ended', public.eastern_timestamp(v_occ.occurrence_date, v_occ.end_time) <= now(),
    'capacity', coalesce(v_occ.max_bookings_per_slot, 1),
    'camp', case when v_occ.camp_id is null then null else (
      select jsonb_build_object(
        'id', camp.id,
        'name', camp.package_name,
        'slug', camp.camp_slug,
        'day_index', v_occ.camp_day_index,
        'days_total', camp.camp_ends_on - camp.camp_starts_on + 1,
        'group_name', grp.name
      )
      from public.coach_packages as camp
      left join public.camp_groups as grp on grp.id = v_occ.camp_group_id
      where camp.id = v_occ.camp_id
    ) end,
    'taken', (select count(*) from public.coach_slot_bookings as b
              where b.occurrence_id = v_occ.id and b.status in ('pending_payment', 'booked', 'completed', 'no_show')),
    'coach', (select jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'photo', coalesce(c.profile_image_url, c.image_url), 'pay_mode', c.pay_mode, 'pay_note', c.pay_note)
              from public.coaches as c where c.id = v_occ.coach_id),
    'booking', jsonb_build_object(
      'id', v_booking.id,
      'status', v_booking.status,
      'payment_status', v_booking.payment_status,
      'paid_amount', (select sum(p.total_amount) from public.payments as p where p.booking_id = v_booking.id),
      'cancellation_reason', v_booking.cancellation_reason,
      'expires_at', v_booking.expires_at
    ),
    'attendance', v_attendance,
    'summary', case when v_missed then null
                    else (select f.summary from public.session_feedback_v2 as f where f.slot_id = v_occ.id and not f.no_show) end,
    -- The session score is shared with families, next to the summary.
    'score', case when v_missed then null
                  else (select s.score from public.session_scores as s
                        join public.session_feedback_v2 as f on f.slot_id = s.slot_id and not f.no_show
                        where s.slot_id = v_occ.id) end,
    'missed_message', case when v_missed then public.feedback_missed_message(v_booking.id) end,
    'note', (select nullif(n.feedback_to_athlete, '') from public.slot_feedback_v2 as n where n.booking_id = v_booking.id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_athlete_home()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_athlete uuid := public.current_athlete_id();
  v_next record;
begin
  if v_athlete is null then
    return null;
  end if;

  select occ.id, occ.occurrence_date, occ.start_time, occ.end_time, occ.session_type, occ.session_name,
         occ.pillar_slot, coalesce(occ.place, occ.location) as place, coach.name as coach_name, booking.status,
         case when occ.camp_id is not null then
           'Camp · ' || coalesce((select camp.package_name from public.coach_packages as camp where camp.id = occ.camp_id), 'Camp')
           || coalesce(' · Day ' || occ.camp_day_index, '')
         end as camp_title
    into v_next
  from public.coach_slot_bookings as booking
  join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
  join public.coaches as coach on coach.id = booking.coach_id
  where booking.athlete_id = v_athlete
    and booking.status in ('requested', 'pending_payment', 'booked')
    and public.eastern_timestamp(occ.occurrence_date, occ.end_time) > now()
  order by occ.occurrence_date, occ.start_time
  limit 1;

  return jsonb_build_object(
    'athlete', (
      select jsonb_build_object(
        'id', a.id,
        'full_name', a.full_name,
        'date_of_birth', a.date_of_birth,
        'sport', a.sport,
        'position', a.position,
        'team', nullif(a.high_school, ''),
        'graduation_year', a.graduation_year,
        'pathway', a.pathway_tags[1],
        'season_goal', a.season_goal,
        'highlight_video_url', a.highlight_video_url,
        'photo', a.profile_image_url
      )
      from public.athlete_profiles as a where a.id = v_athlete
    ),
    'next', case when v_next.id is null then null else jsonb_build_object(
      'id', v_next.id,
      'date', v_next.occurrence_date,
      'start_time', v_next.start_time,
      'end_time', v_next.end_time,
      'title', case when v_next.camp_title is not null then v_next.camp_title
                    when v_next.session_type = 'group' then coalesce(v_next.session_name, 'Group session')
                    else coalesce(v_next.pillar_slot, '1-on-1') end,
      'place', v_next.place,
      'coach_name', v_next.coach_name,
      'status', v_next.status
    ) end,
    -- What they're working on: the latest note or summary a coach shared after a session they came to.
    'focus', (
      select jsonb_build_object(
        'text', coalesce(nullif(note.feedback_to_athlete, ''), feedback.summary),
        'coach_name', coach.name,
        'date', occ.occurrence_date
      )
      from public.coach_slot_bookings as booking
      join public.coach_availability_slot_occurrences as occ on occ.id = booking.occurrence_id
      join public.coaches as coach on coach.id = booking.coach_id
      left join public.session_feedback_v2 as feedback on feedback.slot_id = occ.id and not feedback.no_show
      left join public.slot_feedback_v2 as note on note.booking_id = booking.id
      left join public.slot_attendance_v2 as attendance on attendance.booking_id = booking.id
      where booking.athlete_id = v_athlete
        and coalesce(attendance.attendance::text, 'present') = 'present'
        and coalesce(nullif(note.feedback_to_athlete, ''), feedback.summary) is not null
      order by occ.occurrence_date desc, occ.start_time desc
      limit 1
    ),
    'coaches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', coach.id,
        'name', coach.name,
        'slug', coach.slug,
        'photo', coalesce(coach.profile_image_url, coach.image_url),
        'next_date', (
          select min(occ.occurrence_date)
          from public.coach_slot_bookings as b
          join public.coach_availability_slot_occurrences as occ on occ.id = b.occurrence_id
          where b.athlete_id = v_athlete and b.coach_id = coach.id
            and b.status in ('requested', 'pending_payment', 'booked')
            and public.eastern_timestamp(occ.occurrence_date, occ.start_time) > now()
        ),
        'credits_left', public.coach_credits_left(coach.id, v_athlete)
      ) order by coach.name)
      from public.coaches as coach
      where coach.id in (select public.athlete_coach_ids(v_athlete))
        and coach.id not in (
          select hidden.coach_id from public.athlete_hidden_coaches as hidden where hidden.user_id = auth.uid()
        )
    ), '[]'::jsonb)
  );
end;
$function$;

-- Backfill: registrations that are already held or paid get their camp days.
do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.camp_registrations where status in ('held', 'paid') order by created_at loop
    perform public.sync_camp_registration_bookings(v_id);
  end loop;
end;
$$;
