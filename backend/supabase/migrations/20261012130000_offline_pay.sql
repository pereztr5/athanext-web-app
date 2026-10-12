-- WC4 offline pay: card stays on; invited clients can pay Cash/Zelle/Venmo. Payment stays
-- pending_offline until the coach confirms receipt. Replaces exclusive Booking only mode.

alter table public.coaches
  add column if not exists offline_pay jsonb not null default '{}'::jsonb;

-- Migrate Booking only coaches to offline pay (card always on again).
update public.coaches
set
  offline_pay = jsonb_build_object(
    'on', true,
    'note', coalesce(pay_note, ''),
    'methods', jsonb_build_object(
      'cash', jsonb_build_object('on', true, 'handle', ''),
      'zelle', jsonb_build_object('on', false, 'handle', ''),
      'venmo', jsonb_build_object('on', false, 'handle', '')
    )
  ),
  pay_mode = 'app'
where pay_mode = 'self';

alter table public.coach_slot_bookings drop constraint if exists bookings_v3_payment_status;
alter table public.coach_slot_bookings
  add constraint bookings_v3_payment_status
  check (payment_status = any (array[
    'unpaid', 'requires_action', 'paid', 'refunded', 'direct', 'pending_offline', 'credit'
  ]));

-- True when offline is on and at least one method is usable (handle required for Zelle/Venmo).
create or replace function public.coach_offline_pay_ready(p_offline jsonb)
 returns boolean
 language sql
 immutable
as $function$
  select coalesce((p_offline->>'on')::boolean, false)
    and (
      coalesce(((p_offline->'methods'->'cash'->>'on')::boolean), false)
      or (
        coalesce(((p_offline->'methods'->'zelle'->>'on')::boolean), false)
        and length(trim(coalesce(p_offline->'methods'->'zelle'->>'handle', ''))) > 0
      )
      or (
        coalesce(((p_offline->'methods'->'venmo'->>'on')::boolean), false)
        and length(trim(coalesce(p_offline->'methods'->'venmo'->>'handle', ''))) > 0
      )
    );
$function$;

create or replace function public.booking_coach_card(p_coach_id uuid, p_athlete_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'id', coach.id,
    'name', coach.name,
    'slug', coach.slug,
    'image_url', coalesce(coach.profile_image_url, coach.image_url),
    'specialties', coalesce(to_jsonb(coach.specialties), '[]'::jsonb),
    'positions', coalesce(to_jsonb(coach.positions), '[]'::jsonb),
    'hourly_rate', coach.hourly_rate,
    'locations', coalesce(to_jsonb(coach.locations), '[]'::jsonb),
    'rating', coach.rating,
    'total_reviews', coach.total_reviews,
    'is_client', public.is_coach_client(coach.id, p_athlete_id),
    'needs_request', coach.new_family_booking = 'request' and not public.is_coach_client(coach.id, p_athlete_id),
    'credits', public.coach_credits_left(coach.id, p_athlete_id),
    'pay_mode', coach.pay_mode,
    'pay_note', case
      when public.coach_offline_pay_ready(coach.offline_pay)
        then nullif(trim(coalesce(coach.offline_pay->>'note', '')), '')
      else coach.pay_note
    end,
    'offline_pay', coach.offline_pay,
    'offline_pay_available', public.coach_offline_pay_ready(coach.offline_pay)
      and public.is_coach_client(coach.id, p_athlete_id)
  )
  from public.coaches as coach
  where coach.id = p_coach_id;
$function$;

-- Coach confirms an offline payment was received.
create or replace function public.confirm_offline_payment(p_booking_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null then
    raise exception 'Not a coach' using errcode = '42501';
  end if;
  update public.coach_slot_bookings
    set payment_status = 'direct', updated_at = now()
  where id = p_booking_id
    and coach_id = v_coach
    and payment_status = 'pending_offline'
    and status in ('booked', 'completed');
  if not found then
    raise exception 'Offline payment not found' using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.confirm_offline_payment(uuid) from public;
grant execute on function public.confirm_offline_payment(uuid) to authenticated;

-- Pending offline payments for the coach Home card.
create or replace function public.coach_pending_offline_payments()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_coach uuid := public.current_coach_id();
begin
  if v_coach is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb ORDER BY x.sort_past DESC, x.occurrence_date, x.start_time)
    from (
      select
        b.id as booking_id,
        b.occurrence_id,
        b.athlete_id,
        coalesce(nullif(trim(a.full_name), ''), 'Athlete') as athlete_name,
        coalesce(
          (select nullif(trim(up.name), '') from public.user_profiles as up
            where (up.athlete_id = a.id or up.id = a.user_id)
              and up.persona_type = 'parent'
              and coalesce(up.name, '') <> '' and up.name <> a.full_name
            limit 1),
          nullif(trim(a.full_name), ''),
          'Family'
        ) as payer_name,
        occ.occurrence_date,
        occ.start_time,
        occ.session_name,
        coalesce(occ.price, 0)::numeric as amount,
        (occ.occurrence_date < (timezone('America/New_York', now()))::date) as sort_past,
        (occ.occurrence_date < (timezone('America/New_York', now()))::date) as session_done
      from public.coach_slot_bookings b
      join public.coach_availability_slot_occurrences occ on occ.id = b.occurrence_id
      left join public.athlete_profiles a on a.id = b.athlete_id
      where b.coach_id = v_coach
        and b.payment_status = 'pending_offline'
        and b.status in ('booked', 'completed')
    ) x
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.coach_pending_offline_payments() from public;
grant execute on function public.coach_pending_offline_payments() to authenticated;
